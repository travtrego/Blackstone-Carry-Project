#!/usr/bin/env node
//
// Behavioural checks for the API layer, against a stubbed fetch.
//
//   node evals/run-api-evals.mjs
//
// Companion to run-evals.mjs, which covers the calculator maths. This covers the
// other half of the file: request shaping, retry policy, and the web-search tool
// version fallback. Same constraints as its sibling — no dependencies, no build
// step, exits non-zero on failure.
//
// WHY THIS EXISTS
// The fallback in callClaudeWithSearch cannot be exercised the way the rest of
// the app can. It only fires when the environment rejects a tool type, and the
// only environment that authenticates these calls is Claude's artifact sandbox,
// which cannot be reached from a terminal. So the branch that matters most is
// the one no live run here will ever take: a downgrade that silently does not
// happen leaves Branch 1 dead, and a downgrade that fires when it should not
// quietly gives up dynamic filtering. Both are invisible from the output.
//
// Stubbing fetch is what makes those reachable. It also pins the things that
// were deliberately NOT changed — the pipeline's 4000-token ceiling, disabled
// thinking, the retry and truncation policy from the Sonnet 5 upgrade — so a
// later edit to the shared request builder cannot quietly alter Branch 1 while
// aiming at Branch 2.
//
// It slices the API region out of the source for the same reason run-evals.mjs
// slices the maths: carry-review.jsx has to stay one self-contained file, and a
// second copy of this logic would drift from the first.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "carry-review.jsx");

const START = "// ---------- API ----------";
const END = "function useGoogleFont()";
const EXPORTS = "callClaudeWithSearch, callClaude, callClaudeOnce, SEARCH_TOOL_VARIANTS, buildSearchTools, isPossibleToolTypeRejection, getSearchVariantNote, extractJSON, ApiError";
const src = await readFile(SRC, "utf8");
const a = src.indexOf(START), b = src.indexOf(END);
if (a === -1) throw new Error(`Could not find "${START}" in ${SRC}. Did the file get reorganised?`);
if (b === -1) throw new Error(`Could not find "${END}" in ${SRC}. Did the file get reorganised?`);
if (b < a) throw new Error(`"${END}" appears before "${START}" in ${SRC}. The extracted region would be empty or inverted.`);
// Each case gets a fresh module instance. The variant downgrade is module-level
// state by design (it has to persist across calls within a session), so a cached
// module would leak a downgrade from one case into the next and the "remembers
// the downgrade" and "does not downgrade" cases would silently agree.
let seq = 0;
const load = () => import("data:text/javascript," + encodeURIComponent(
  src.slice(a, b) + `\nexport { ${EXPORTS} };\n//${seq++}\n`));

let pass = 0, fail = 0;
const check = (l, ok, d = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${d ? "  — " + d : ""}`); };

function stub(responses) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return {
      ok: r.status === 200, status: r.status, statusText: "x",
      json: async () => r.body,
    };
  };
  return calls;
}
const okBody = (text) => ({ status: 200, body: { stop_reason: "end_turn", content: [{ type: "text", text }] } });
const errBody = (status, message) => ({ status, body: { error: { message } } });

console.log("API layer — stubbed fetch");
console.log(`source: carry-review.jsx (${START} … ${END})`);
console.log("Search tool variant selection");

// 1. Modern first.
{
  const m = await load();
  const calls = stub([okBody("hi")]);
  const out = await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {} } });
  check("asks for the modern variant first",
    calls.length === 1 && calls[0].tools[0].type === "web_search_20260209" && out === "hi",
    calls[0].tools[0].type);
  check("no downgrade note when the modern variant is accepted", m.getSearchVariantNote() === null);
}

// 2. Fallback on a tool-type rejection — with error wording deliberately unlike
// anything the code could pattern-match, since the sandbox's real phrasing has
// never been observed. If this only passed for messages naming the type string,
// the test would be checking the guess rather than the behaviour.
{
  const m = await load();
  const calls = stub([errBody(400, "Bad Request"), okBody("ok")]);
  const out = await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {}, fetch: {} } });
  check("falls back to the basic pair when the type is rejected",
    calls.length === 2 && calls[1].tools[0].type === "web_search_20250305" && calls[1].tools[1].type === "web_fetch_20250910" && out === "ok",
    calls.map((c) => c.tools[0].type).join(" -> "));
  check("the downgrade is surfaced, not silent", /web_search_20250305/.test(m.getSearchVariantNote() || ""));

  // 3. Sticky for the rest of the session.
  const calls2 = stub([okBody("second")]);
  await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {} } });
  check("remembers the downgrade — no second wasted probe",
    calls2.length === 1 && calls2[0].tools[0].type === "web_search_20250305", calls2[0].tools[0].type);
}

// 4. An unrelated 400 fails on both pairs, so it must leave no trace. The
// downgrade is probed but not kept — a session permanently downgraded by a
// billing error would quietly lose dynamic filtering for the rest of its life.
{
  const m = await load();
  const calls = stub([errBody(400, "credit balance is too low")]);
  let threw = null;
  try { await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {} } }); } catch (e) { threw = e; }
  check("an unrelated 400 leaves no permanent downgrade",
    threw && m.getSearchVariantNote() === null, `${calls.length} call(s), note=${m.getSearchVariantNote()}`);

  // And the next call must still reach for the modern pair.
  const calls2 = stub([okBody("fine")]);
  await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {} } });
  check("after an unrelated 400 the modern variant is still preferred",
    calls2[0].tools[0].type === "web_search_20260209", calls2[0].tools[0].type);
}

// 5. Both generations failing reports both.
{
  const m = await load();
  stub([errBody(400, 'unsupported tool type "web_search_20260209"'), errBody(400, "still broken")]);
  let msg = "";
  try { await m.callClaudeWithSearch({ system: "s", prompt: "p", toolSpec: { search: {} } }); } catch (e) { msg = e.message; }
  check("reports both errors, and says the tool type is not the cause",
    msg.includes("web_search_20260209") && msg.includes("web_search_20250305") && msg.includes("still broken") && /not the cause/.test(msg),
    msg.slice(0, 90));
}

console.log("\nBranch 1 is byte-for-byte unchanged");
{
  const m = await load();
  const built = m.buildSearchTools({ search: {} }, "modern");
  check("retriever tool array matches the pre-change literal",
    JSON.stringify(built) === JSON.stringify([{ type: "web_search_20260209", name: "web_search" }]),
    JSON.stringify(built));
}
{
  const m = await load();
  const calls = stub([okBody("x")]);
  await m.callClaude({ system: "s", prompt: "p", tools: [{ type: "t", name: "n" }] });
  check("pipeline defaults untouched (4000 tokens, thinking disabled, sonnet-5)",
    calls[0].max_tokens === 4000 && calls[0].thinking.type === "disabled" && calls[0].model === "claude-sonnet-5",
    `${calls[0].max_tokens} / ${calls[0].thinking.type}`);
}

console.log("\nRefresh call shape");
{
  const m = await load();
  const calls = stub([okBody("{}")]);
  await m.callClaudeWithSearch({
    system: "s", prompt: "p",
    toolSpec: { fetch: { allowed_domains: ["blackstone.com"], max_content_tokens: 120000 }, search: { allowed_domains: ["blackstone.com"], max_uses: 5 } },
    maxTokens: 16000, timeoutMs: 180000, thinking: { type: "adaptive" },
  });
  const b = calls[0];
  check("refresh overrides land in the request body",
    b.max_tokens === 16000 && b.thinking.type === "adaptive", `${b.max_tokens} / ${b.thinking.type}`);
  check("domain restriction is enforced by the tool, not just the prompt",
    b.tools.every((t) => JSON.stringify(t.allowed_domains) === '["blackstone.com"]'),
    JSON.stringify(b.tools.map((t) => t.type)));
  check("web_fetch generation is paired with web_search",
    b.tools.find((t) => t.name === "web_fetch").type === "web_fetch_20260209");
}

console.log("\nExisting retry/truncation behaviour (regression guard)");
{
  const m = await load();
  const calls = stub([{ status: 200, body: { stop_reason: "max_tokens", content: [{ type: "text", text: "cut" }] } }]);
  let e = null;
  try { await m.callClaude({ system: "s", prompt: "p" }); } catch (err) { e = err; }
  check("truncation still throws and is not retried", calls.length === 1 && e?.name === "TruncationError", `${calls.length} attempt(s)`);
}
{
  const m = await load();
  const calls = stub([errBody(500, "boom"), errBody(500, "boom"), okBody("recovered")]);
  const out = await m.callClaude({ system: "s", prompt: "p" });
  check("500 still retries and recovers on the third attempt", calls.length === 3 && out === "recovered", `${calls.length} attempts`);
}
{
  const m = await load();
  const calls = stub([errBody(400, "bad request")]);
  try { await m.callClaude({ system: "s", prompt: "p" }); } catch {}
  check("400 still fails on the first attempt", calls.length === 1, `${calls.length} attempt(s)`);
}

console.log("\nRefresh payload survives the trip out of the model");
// The seam between the two halves of the file: the refresh agent returns text,
// and normalizeRefreshedFunds needs an object. extractJSON is what bridges them,
// and it is asked to do so against a model that was told "no markdown fences"
// but may add them anyway. A failure here reads as an extraction failure, which
// would send someone hunting in entirely the wrong place.
{
  const m = await load();
  const payload = {
    asOf: { year: 2026, month: 6 }, sourceUrl: "https://www.blackstone.com/x.pdf",
    sourceLabel: "2Q26 supplemental", sourcePath: "direct", complete: true, notes: "",
    funds: [{ name: "BCP IX", period: "2024-2030", start: 2024, end: 2030, committed: 21.8, available: 18.4, moic: 1.5, irr: "24% (early)", status: "In investment period" }],
  };
  const fenced = "```json\n" + JSON.stringify(payload, null, 2) + "\n```";
  const parsed = m.extractJSON(fenced);
  check("fenced JSON is recovered intact",
    parsed?.funds?.length === 1 && parsed.asOf.month === 6 && parsed.funds[0].irr === "24% (early)",
    JSON.stringify(parsed?.funds?.[0]?.irr));

  // A preamble is the other thing a model does when told not to.
  const chatty = "Here is the table you asked for:\n\n" + JSON.stringify(payload);
  check("a preamble before the JSON is tolerated", m.extractJSON(chatty)?.funds?.length === 1);

  // And the failure case has to be a clean null, not a throw — the caller turns
  // it into "did not survive validation", which is the honest message.
  check("unparseable output returns null rather than throwing", m.extractJSON("I could not reach the document.") === null);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
