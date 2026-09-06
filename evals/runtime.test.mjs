import test from "node:test";
import assert from "node:assert/strict";
import { callClaude, parseCompletion, isPrimarySource } from "../lib/claude-client.js";
import { executeReview, STAGE_KEYS, validateJudge, stageRequest } from "../lib/review-flow.js";
import { computeCarry, isComputable, FUNDS, MODEL_NOTICE, toCSV } from "../lib/carry.js";
import { POST } from "../app/api/claude/route.ts";

const verdict = { completeness: { score: 8, note: "Complete" }, accuracy: { score: 9, note: "Accurate" }, skepticValueAdd: { score: 7, note: "Useful" }, overall: "Review complete" };
const completion = (text = "OK") => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });
const args = { system: "Test", prompt: "Test" };
function mockKey(t) {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "unit-test-only";
  t.after(() => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  });
}

test("completion rejects unfinished output and invalid responses", () => {
  for (const reason of ["max_tokens", "pause_turn", "tool_use", "refusal", null]) assert.throws(() => parseCompletion({ ...completion(), stop_reason: reason }));
  assert.throws(() => parseCompletion(completion("")));
  assert.throws(() => parseCompletion({ stop_reason: "end_turn" }));
  assert.throws(() => parseCompletion({ stop_reason: "end_turn", content: [null] }), /invalid response/);
});
test("retrieval requires genuine primary-domain search citations", () => {
  assert.throws(() => parseCompletion(completion("SOURCE: https://sec.gov/fake"), true));
  const data = { stop_reason: "end_turn", content: [
    { type: "text", text: "Searching..." },
    { type: "web_search_tool_result", content: [] },
    { type: "text", text: "Dated excerpts", citations: [{ type: "web_search_result_location", title: "Filing", url: "https://www.sec.gov/Archives/filing.htm" }] },
  ] };
  const result = parseCompletion(data, true);
  assert.ok(result.includes("https://www.sec.gov/Archives/filing.htm"));
  assert.ok(!result.includes("Searching..."));
  data.content[2].citations[0].url = "https://sec.gov.attacker.test";
  assert.throws(() => parseCompletion(data, true));
});
test("search errors hidden inside HTTP 200 are failures", () => {
  const data = completion("A result");
  data.content.unshift({ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } });
  assert.throws(() => parseCompletion(data, true), /unavailable/);
});
test("source URL validation rejects lookalikes and unsafe protocols", () => {
  for (const url of ["http://sec.gov", "javascript:alert(1)", "https://evilblackstone.com", "https://sec.gov.evil.test"]) assert.equal(isPrimarySource(url), false);
  assert.equal(isPrimarySource("https://www.blackstone.com/filing"), true);
});
test("HTTP errors and network failures never retry", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ error: { message: "Timed out" } }, { status: 504 }); });
  await assert.rejects(callClaude(args), /Timed out/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new TypeError("Failed to fetch"); });
  await assert.rejects(callClaude(args), /Cannot reach the local server/);
  assert.equal(calls, 2);
});
test("deadline stays active while reading response body", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => ({
    ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
  }));
  await assert.rejects(callClaude({ ...args, timeoutMs: 10 }), /exceeded/);
});
test("user cancellation aborts immediately and never retries", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    calls++;
    controller.abort();
    options.signal.throwIfAborted();
  });
  await assert.rejects(callClaude({ ...args, signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});
test("judge validates finite scores and all notes", () => {
  assert.deepEqual(validateJudge(JSON.stringify(verdict)), verdict);
  for (const score of [-1, 11, "8", null]) assert.throws(() => validateJudge(JSON.stringify({ ...verdict, accuracy: { score, note: "x" } })));
  assert.throws(() => validateJudge("{}"));
});
test("full flow preserves restricted agent contexts", async () => {
  const results = {};
  const calls = [];
  await executeReview({ call: async (request) => {
    calls.push(request);
    return calls.length === 6 ? JSON.stringify(verdict) : "stage-" + calls.length;
  }, onDone: (key, value) => { results[key] = value; } });
  assert.deepEqual(Object.keys(results), STAGE_KEYS);
  assert.ok(calls[2].prompt.includes("stage-2"));
  assert.ok(!calls[2].prompt.includes("stage-1"));
  assert.ok(calls[3].prompt.includes("stage-3"));
  assert.ok(!calls[3].prompt.includes("stage-1"));
  assert.ok(calls[5].prompt.includes("stage-1") && calls[5].prompt.includes("stage-5"));
});
test("retry resumes failed stage, without rerunning retrieval", async () => {
  const seen = [];
  await executeReview({ completed: { retrieve: "source", mechanics: "mechanics" }, onStart: (key) => seen.push(key), call: async () => seen.at(-1) === "judge" ? JSON.stringify(verdict) : "result" });
  assert.deepEqual(seen, STAGE_KEYS.slice(2));
});
test("cancellation never starts downstream stages", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(executeReview({ signal: controller.signal, call: async () => { calls++; controller.abort(); return "result"; } }), { name: "AbortError" });
  assert.equal(calls, 1);
});
test("retrieval uses bounded direct-search request type", () => {
  assert.equal(stageRequest("retrieve", {}).tools[0].type, "web_search_20250305");
});
test("carry conserves value and rejects invalid data", () => {
  for (const fund of FUNDS.filter(isComputable)) {
    const c = computeCarry(fund);
    assert.ok(Math.abs(c.lpTotal + c.gpTotal - c.totalValue) < 1e-8);
    assert.ok(c.gpTotal >= 0);
  }
  const base = { start: 2020, end: 2022, committed: 10, available: 1, moic: 2 };
  for (const override of [{ moic: NaN }, { committed: Infinity }, { available: 11 }, { moic: -1 }, { start: 2023 }]) {
    assert.equal(isComputable({ ...base, ...override }), false);
    assert.throws(() => computeCarry({ ...base, ...override }));
  }
  const loss = computeCarry({ ...base, moic: 0.5 });
  assert.equal(loss.gpTotal, 0);
  assert.equal(loss.lpTotal, loss.totalValue);
});

test("every exported fund retains assumptions and unverified-source warning", () => {
  const rows = toCSV().split("\n").slice(1);
  assert.equal(rows.length, FUNDS.length);
  for (const row of rows) assert.ok(row.includes(MODEL_NOTICE));
});

const request = (body, headers = {}, host = "localhost:3000") => new Request("http://" + host + "/api/claude", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
test("proxy rejects malformed, oversized and cross-origin requests without paid calls", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Must not call upstream"); });
  mockKey(t);
  for (const body of [null, [], {}, { ...args, tools: null }, { ...args, tools: [{}] }]) assert.equal((await POST(request(body))).status, 400);
  assert.equal((await POST(request(args, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await POST(request(args, {}, "public.example"))).status, 403);
  assert.equal((await POST(request({ ...args, prompt: "x".repeat(130000) }))).status, 413);
});
test("proxy owns tool limits, credentials and prevents overlapping requests", async (t) => {
  mockKey(t);
  let release, sent;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    sent = JSON.parse(options.body);
    await new Promise((resolve) => { release = resolve; });
    return Response.json(completion());
  });
  const pending = POST(request({ ...args, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 999 }] }));
  while (!release) await new Promise((r) => setTimeout(r, 1));
  assert.equal((await POST(request(args))).status, 429);
  assert.equal(sent.tools[0].max_uses, 2);
  assert.deepEqual(sent.tools[0].allowed_domains, ["sec.gov", "blackstone.com"]);
  assert.equal(sent.model, "claude-sonnet-5");
  release();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes("unit-test-only"));
});
test("proxy abort signal propagates to upstream", async (t) => {
  mockKey(t);
  const controller = new AbortController();
  let begun;
  const started = new Promise((r) => { begun = r; });
  t.mock.method(globalThis, "fetch", (_url, options) => new Promise((_resolve, reject) => {
    begun();
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const req = new Request(request(args), { signal: controller.signal });
  const pending = POST(req);
  await started;
  controller.abort();
  assert.equal((await pending).status, 499);
});
