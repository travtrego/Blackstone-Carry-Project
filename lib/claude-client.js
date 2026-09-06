"use client";

// One paid request per explicit action. Deadlines cover headers AND body reads.
export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
}
export function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : cleaned); } catch { return null; }
}
export function isPrimarySource(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ["sec.gov", "blackstone.com"].some((domain) =>
      parsed.hostname === domain || parsed.hostname.endsWith("." + domain));
  } catch { return false; }
}
export function parseCompletion(data, requiresSources = false) {
  if (data?.stop_reason === "max_tokens") throw new Error("Claude's response was cut off. No partial answer was passed to the next stage.");
  if (data?.stop_reason !== "end_turn") throw new Error("Claude did not finish this stage (" + (data?.stop_reason || "invalid response") + "). Retry this stage manually.");
  if (!Array.isArray(data.content) || data.content.some((b) => !b || typeof b !== "object" || typeof b.type !== "string")) throw new Error("Claude returned an invalid response.");
  const searchError = data.content.find((b) => b.type === "web_search_tool_result" && b.content?.type === "web_search_tool_result_error");
  if (searchError) throw new Error("Source search failed: " + searchError.content.error_code + ". No automatic retry was made.");
  // Ignore search preambles; only text after the last tool result is final.
  const lastTool = data.content.reduce((last, b, i) => b.type === "web_search_tool_result" ? i : last, -1);
  const blocks = data.content.slice(lastTool + 1).filter((b) => b.type === "text" && typeof b.text === "string");
  const text = blocks.map((b) => b.text).join("\n\n").trim();
  if (!text) throw new Error("Claude returned no completed text.");
  if (!requiresSources) return text;
  if (text.includes("SOURCE_NOT_FOUND")) throw new Error("No usable primary-source disclosure was found. The review stopped before analysis.");
  const sources = new Map();
  for (const block of blocks) for (const citation of Array.isArray(block.citations) ? block.citations : []) {
    if (citation?.type === "web_search_result_location" && isPrimarySource(citation.url)) sources.set(citation.url, typeof citation.title === "string" ? citation.title : citation.url);
  }
  if (!sources.size || lastTool < 0) throw new Error("Retrieval returned no verifiable SEC/Blackstone search citations. The review stopped before analysis.");
  return text + "\n\nPRIMARY-SOURCE CITATIONS (returned by Anthropic):\n" +
    [...sources].map(([url, title]) => title + "\n" + url).join("\n\n");
}
export async function callClaude({ system, prompt, tools, signal, timeoutMs }) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const ms = timeoutMs ?? (tools ? 95000 : 65000);
  const timer = setTimeout(abort, ms);
  try {
    const response = await fetch("/api/claude", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, prompt, tools }), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data?.error) throw new ApiError(data?.error?.message || "The server rejected the request (HTTP " + response.status + ").", response.status);
    return parseCompletion(data, Boolean(tools));
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Run cancelled.", "AbortError");
    if (controller.signal.aborted) throw new Error("This stage exceeded " + ms / 1000 + " seconds. No automatic retry was made.");
    if (error instanceof TypeError) throw new Error("Cannot reach the local server. Start the tool, refresh this page, and retry.");
    if (error instanceof SyntaxError) throw new Error("The server returned an unreadable response. No automatic retry was made.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
