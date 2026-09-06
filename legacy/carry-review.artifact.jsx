import { useState, useEffect } from "react";
import { Search, FileText, Scissors, ShieldAlert, FileCheck, Gavel, Loader2, Calculator, Download, ChevronDown } from "lucide-react";

const STAGES = [
  { key: "retrieve", label: "Retrieve source", sub: "web_search · sec.gov, blackstone.com", icon: Search },
  { key: "mechanics", label: "Mechanics explainer", sub: "hurdle, catch-up, split, triggers", icon: FileText },
  { key: "summarize", label: "Neutral summarizer", sub: "blind compression", icon: Scissors },
  { key: "skeptic", label: "Disclosure skeptic", sub: "summary only, no raw text", icon: ShieldAlert },
  { key: "synthesis", label: "Synthesis memo", sub: "mechanics + open questions", icon: FileCheck },
  { key: "judge", label: "Judge", sub: "memo graded vs. raw source", icon: Gavel },
];

const COLOR = {
  void: "#0F0D0A", panel: "#1A1712", panelEdge: "#2A2419",
  vellum: "#E4DCC5", vellumDim: "#C7BE9F",
  brass: "#8B7355", brassDim: "#5C5040",
  green: "#6B8F71", red: "#A3423A", gold: "#C9A227",
};

// ---------- Fund reference data (from uploaded table, data as of 6/30/2026) ----------
// computable = has committed, available, moic, and a resolvable deployment year
//
// clearsHurdle is set by hand, not derived at runtime. It means: this fund's
// DISCLOSED net IRR is settled and at or above 12%, so it comfortably beat the
// 8% hurdle regardless of what the waterfall model below computes. The rule used
// to populate it:
//   - 12%, not 8%, because IRR and hurdle-on-paid-in aren't computed the same
//     way — a fund at 8-9% is genuinely too close to call (see eval case 3,
//     which expects BCP V at 8% IRR to show ~zero carry, correctly).
//   - Omitted for any IRR the source labels "(early)", "(very early)",
//     "not meaningful", or "early history". An unrealized early-life IRR is not
//     evidence that a hurdle was cleared.
// Absence of the field therefore means "not clearly above the hurdle", not
// "nobody checked". It is a human judgment on purpose: parsing these IRR strings
// in code would fail silently on a label like "(4%)" or "8-12%".
const FUNDS = [
  { name: "BCP I-III", period: "1987-2002", start: 1987, end: 2002, committed: 6.2, available: 0.0, moic: 2.4, irr: "19%", clearsHurdle: true, status: "Fully realized / mature" },
  { name: "BCOM", period: "2000-2006", start: 2000, end: 2006, committed: 2.1, available: 0.0, moic: 1.4, irr: "6%", status: "Fully realized / mature" },
  { name: "BCP IV", period: "2002-2005", start: 2002, end: 2005, committed: 6.5, available: 0.0, moic: 2.9, irr: "36%", clearsHurdle: true, status: "Fully realized / mature" },
  { name: "BCP V", period: "2005-2011", start: 2005, end: 2011, committed: 21.0, available: 1.0, moic: 1.9, irr: "8%", status: "Harvesting" },
  { name: "BCP VI", period: "2011-2016", start: 2011, end: 2016, committed: 15.2, available: 1.3, moic: 2.2, irr: "12%", clearsHurdle: true, status: "Harvesting" },
  { name: "BCP VII", period: "2016-2020", start: 2016, end: 2020, committed: 18.9, available: 1.3, moic: 2.1, irr: "12%", clearsHurdle: true, status: "Harvesting" },
  { name: "BCP VIII", period: "2020-2024", start: 2020, end: 2024, committed: 25.8, available: 5.9, moic: 1.6, irr: "10%", status: "Post-investment period / harvesting" },
  { name: "BCP IX", period: "2024-2030", start: 2024, end: 2030, committed: 21.8, available: 18.4, moic: 1.5, irr: "24% (early)", status: "In investment period" },
  { name: "Energy I", period: "2011-2015", start: 2011, end: 2015, committed: 2.4, available: 0.2, moic: 2.0, irr: "12%", clearsHurdle: true, status: "Mature / harvesting" },
  { name: "Energy II", period: "2015-2020", start: 2015, end: 2020, committed: 4.9, available: 0.8, moic: 2.0, irr: "9%", status: "Harvesting" },
  { name: "Energy III", period: "2020-2024", start: 2020, end: 2024, committed: 4.4, available: 1.8, moic: 3.0, irr: "33%", clearsHurdle: true, status: "Post-investment period" },
  { name: "Energy Transition IV", period: "2024-2026", start: 2024, end: 2026, committed: 5.9, available: 2.8, moic: 2.0, irr: "94% (very early)", status: "Recently ended investment period" },
  { name: "Energy Transition V", period: "2026-2032", start: 2026, end: 2032, committed: 5.7, available: 5.7, moic: null, irr: null, status: "New / in investment period" },
  { name: "BCP Asia I", period: "2017-2021", start: 2017, end: 2021, committed: 2.4, available: 0.4, moic: 2.3, irr: "19%", clearsHurdle: true, status: "Harvesting" },
  { name: "BCP Asia II", period: "2021-2027", start: 2021, end: 2027, committed: 6.8, available: 3.6, moic: 2.0, irr: "27%", clearsHurdle: true, status: "In investment period" },
  { name: "BCP Asia III", period: "TBD (final close 2Q26)", start: 2026, end: 2026, committed: 13.1, available: 13.1, moic: null, irr: null, status: "Final close completed 2Q26" },
  { name: "Core Private Equity I", period: "2017-2021", start: 2017, end: 2021, committed: 4.8, available: 1.2, moic: 2.5, irr: "14%", clearsHurdle: true, status: "Harvesting" },
  { name: "Core Private Equity II", period: "2021-2027", start: 2021, end: 2027, committed: 8.2, available: 6.0, moic: 1.8, irr: "16%", clearsHurdle: true, status: "In investment period" },
  { name: "Tactical Opportunities", period: "Various", start: null, end: null, committed: 33.8, available: 14.4, moic: 1.6, irr: "10%", status: "Multiple vintages; active" },
  { name: "Tactical Opportunities Co-invest & Other", period: "Various", start: null, end: null, committed: 10.5, available: 1.1, moic: 1.7, irr: "15%", status: "Multiple vintages" },
  { name: "BXG I", period: "2020-2025", start: 2020, end: 2025, committed: 5.0, available: 0.3, moic: 1.2, irr: "2%", status: "Post-investment period" },
  { name: "BXG II", period: "2025-2030", start: 2025, end: 2030, committed: 4.6, available: 3.7, moic: 1.1, irr: "not meaningful", status: "In investment period" },
  { name: "Strategic Partners I-V", period: "Various", start: null, end: null, committed: 11.0, available: 0.0, moic: 1.7, irr: "13%", status: "Mature vintages" },
  { name: "Strategic Partners VI", period: "2014-2016", start: 2014, end: 2016, committed: 4.4, available: 0.4, moic: 1.7, irr: "13%", clearsHurdle: true, status: "Harvesting" },
  { name: "Strategic Partners VII", period: "2016-2019", start: 2016, end: 2019, committed: 7.5, available: 1.6, moic: 1.9, irr: "15%", clearsHurdle: true, status: "Harvesting" },
  { name: "Strategic Partners VIII", period: "2019-2021", start: 2019, end: 2021, committed: 10.8, available: 3.4, moic: 1.7, irr: "17%", clearsHurdle: true, status: "Harvesting" },
  { name: "Strategic Partners IX", period: "2021-2026", start: 2021, end: 2026, committed: 19.7, available: 1.5, moic: 1.5, irr: "17%", clearsHurdle: true, status: "Investment period ended Mar. 2026" },
  { name: "Strategic Partners X", period: "2026-2031", start: 2026, end: 2031, committed: 11.0, available: 8.6, moic: null, irr: null, status: "In investment period" },
  { name: "Strategic Partners GP Solutions", period: "2024-2026", start: 2024, end: 2026, committed: 2.1, available: 0.3, moic: 1.1, irr: "early history", status: "Recently ended investment period" },
  { name: "Strategic Partners Infrastructure III", period: "2020-2024", start: 2020, end: 2024, committed: 3.3, available: 0.7, moic: 1.6, irr: "15%", clearsHurdle: true, status: "Harvesting" },
  { name: "Strategic Partners Infrastructure IV", period: "2024-2029", start: 2024, end: 2029, committed: 4.8, available: 3.5, moic: 1.9, irr: "not meaningful", status: "In investment period" },
  { name: "Clarus IV", period: "2018-2020", start: 2018, end: 2020, committed: 0.9, available: 0.0, moic: 1.7, irr: "9%", status: "Harvesting" },
  { name: "BXLS V", period: "2020-2025", start: 2020, end: 2025, committed: 5.1, available: 2.3, moic: 2.0, irr: "17%", clearsHurdle: true, status: "Post-investment period" },
  { name: "BXLS VI", period: "2025-2031", start: 2025, end: 2031, committed: 6.5, available: 6.4, moic: null, irr: null, status: "In investment period" },
  { name: "BXPE platform", period: "Evergreen", start: null, end: null, committed: null, available: null, moic: null, irr: null, status: "Continuous fundraising / deployment" },
];

const REPORT_DATE_DEC = 2026.5; // June 30, 2026
const HURDLE_RATE = 0.08;
const CATCHUP_MULT = 0.25; // hurdle * (20/80)
const CARRY_SPLIT = 0.2;
// Capped at a typical full closed-end fund life — mature/realized funds don't
// keep compounding a hurdle to today (see Bug #1 in the README).
const MAX_FUND_LIFE_YEARS = 12;
// Floored, because funds still inside their investment period have a deployment
// midpoint in the future, which would otherwise produce a negative elapsed time.
const MIN_YEARS = 0.1;

function isComputable(f) {
  return f.start != null && f.end != null && typeof f.committed === "number" && typeof f.available === "number" && typeof f.moic === "number";
}

function computeCarry(f) {
  const paidIn = f.committed - f.available;
  const years = Math.min(Math.max(REPORT_DATE_DEC - (f.start + f.end) / 2, MIN_YEARS), MAX_FUND_LIFE_YEARS);
  const totalValue = f.moic * paidIn;
  const profit = totalValue - paidIn;
  const hurdleAmt = paidIn * (Math.pow(1 + HURDLE_RATE, years) - 1);

  let catchUp = 0, gpSplit = 0, lpSplit = 0;
  if (profit > hurdleAmt) {
    const remaining = profit - hurdleAmt;
    catchUp = Math.min(remaining, hurdleAmt * CATCHUP_MULT);
    const afterCatchUp = remaining - catchUp;
    gpSplit = afterCatchUp * CARRY_SPLIT;
    lpSplit = afterCatchUp * (1 - CARRY_SPLIT);
  }
  const gpTotal = catchUp + gpSplit;
  const lpTotal = paidIn + Math.min(profit, hurdleAmt) + lpSplit;
  const effectivePct = profit > 0 ? gpTotal / profit : 0;

  return { paidIn, years, totalValue, profit, hurdleAmt, catchUp, gpSplit, lpSplit, gpTotal, lpTotal, effectivePct };
}

// Conditions where the computed number is real arithmetic but a misleading
// answer, so it gets flagged rather than presented as comparable to a harvested
// fund's. Same principle as Bug #2 in the README: an honest flag beats a
// confident wrong number.
function getWarnings(f, c) {
  const warnings = [];
  if (c.years <= MIN_YEARS) {
    warnings.push(
      `${f.name} is still early in its deployment window — the midpoint of ${f.period} falls at or after the June 2026 report date, so effectively no hurdle has accrued (${(c.hurdleAmt * 1000).toFixed(0)}M on $${c.paidIn.toFixed(2)}B paid-in). With almost nothing to clear, the GP takes the full 20%. This carry is computed against unrealized marks, not distributions, and is almost certainly overstated.`
    );
  }
  // The model says a fund earned no carry, but the fund's own disclosed IRR says
  // it comfortably beat the hurdle. The disclosure wins — the model is treating
  // all paid-in capital as one lump sum at the deployment midpoint, and there is
  // no capital-call timing in the public data to correct that with.
  if (f.clearsHurdle && c.effectivePct < 0.005) {
    warnings.push(
      `${f.name} reports a ${f.irr} net IRR — comfortably clear of the 8% hurdle — yet this model computes essentially no carry for it. The model assumes every dollar was paid in at once at the midpoint of ${f.period} and sat there, so it compounds a full ${c.years.toFixed(1)}-year hurdle ($${c.hurdleAmt.toFixed(2)}B) against $${c.profit.toFixed(2)}B of profit. Real funds call and return capital gradually, and the public data carries no capital-call timing to model that with. Treat the figure below as understated, not as an estimate.`
    );
  }
  return warnings;
}

// Columns mirror the nine waterfall steps shown in the UI, in the same order, so
// the export and the on-screen calculation can be reconciled line for line.
const CSV_HEADER = [
  "Fund", "Period", "Committed ($B)", "Available ($B)", "Paid-in ($B)", "MOIC",
  "Reported net IRR", "Total value ($B)", "Profit ($B)", "Years elapsed",
  "Hurdle owed ($B)", "GP catch-up ($B)", "GP 80/20 split ($B)",
  "GP carry total ($B)", "LP proceeds ($B)", "Effective carry %", "Status", "Warnings",
];

function toCSV() {
  const rows = [CSV_HEADER];
  FUNDS.forEach((f) => {
    if (!isComputable(f)) {
      rows.push([
        f.name, f.period, f.committed ?? "n/d", f.available ?? "n/d", "n/a", f.moic ?? "n/a",
        f.irr ?? "n/a", "n/a", "n/a", "n/a",
        "n/a", "n/a", "n/a",
        "n/a", "n/a", "insufficient data", f.status, "",
      ]);
      return;
    }
    const c = computeCarry(f);
    const w = getWarnings(f, c);
    rows.push([
      f.name, f.period, f.committed.toFixed(1), f.available.toFixed(1), c.paidIn.toFixed(2), f.moic.toFixed(2),
      f.irr ?? "n/d", c.totalValue.toFixed(2), c.profit.toFixed(2), c.years.toFixed(1),
      c.hurdleAmt.toFixed(2), c.catchUp.toFixed(2), c.gpSplit.toFixed(2),
      c.gpTotal.toFixed(2), c.lpTotal.toFixed(2),
      w.length ? "n/m" : (c.effectivePct * 100).toFixed(1) + "%", f.status,
      w.join(" "),
    ]);
  });
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV() {
  const csv = toCSV();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blackstone_pe_carry_for_dummies.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- API ----------
// Races a request against a timer and actually cancels it when the timer wins.
//
// The previous version took an already-started fetch and raced it with
// Promise.race. That surfaces a timeout to the caller, but nothing ever cancels
// the request — it runs to completion in the background regardless. Paired with
// the retry loop, one slow retriever stage could leave three overlapping
// requests in flight against the same endpoint. It also never cleared its timer,
// so even a fast response left a pending callback alive for the full 45 or 90
// seconds.
//
// Owning the fetch here is what makes cancellation possible at all: the signal
// has to be passed to fetch at call time, so a timeout can't be bolted on to a
// promise after the fact.
async function fetchWithTimeout(url, options, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    // Check the signal rather than the error type. An aborted fetch rejects
    // with a generic AbortError that reads like a network fault, which would be
    // misleading in the UI — this is our own deadline, and should say so.
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${ms / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Carries the HTTP status so the retry layer can tell a transient failure from a
// permanent one.
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Thrown when the model ran out of output budget mid-response. Marked
// permanently non-retryable on purpose: an identical request truncates at an
// identical place, so retrying burns three calls to produce the same cut-off
// text and then reports a misleading "failed after 3 attempts".
class TruncationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TruncationError";
    this.retryable = false;
  }
}

// 408 and 429 are the only 4xx codes worth retrying (request timeout, rate
// limit). Anything else in the 4xx range is a malformed request that will fail
// identically on every attempt. Errors carrying no status — network failures,
// our own timeout, an empty completion — are treated as transient.
function isRetryable(e) {
  if (e.retryable === false) return false;
  if (e.status == null) return true;
  if (e.status === 408 || e.status === 429) return true;
  return e.status >= 500;
}

async function callClaudeOnce({ system, prompt, tools }) {
  // `thinking` is set explicitly rather than omitted. On Sonnet 4.6 an absent
  // `thinking` meant no thinking at all; on Sonnet 5 it means adaptive thinking
  // runs. Leaving it out would have silently changed how all six stages behave
  // as a side effect of the model swap. Disabled for now so this run stays
  // comparable to the three already documented in the README — worth turning on
  // for the skeptic and judge stages once there is a baseline to compare to.
  //
  // max_tokens covers thinking and response text together. 4000 rather than the
  // previous 1500 because stage 1 is asked to return raw filing language, and
  // 1500 tokens is roughly 1100 words — tight enough that truncation was
  // plausible, and until the check below nothing would have revealed it.
  const body = {
    model: "claude-sonnet-5",
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: prompt }],
  };
  if (tools) body.tools = tools;
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    },
    tools ? 90000 : 45000,
    "API call"
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const detail = data?.error?.message || (data?.error && JSON.stringify(data.error)) || res.statusText || "no detail";
    throw new ApiError(`API error (HTTP ${res.status}): ${detail}`, res.status);
  }
  // The API reports why generation stopped, and "max_tokens" means the response
  // was cut off mid-sentence. Once the text is pulled out of the content blocks
  // a truncated response is indistinguishable from a complete one, so without
  // this check a cut-off answer flows silently down the chain. That matters most
  // at stage 1: every later stage consumes the retriever's output, and the judge
  // grades the final memo against that same raw text — so a truncation there
  // degrades the whole pipeline *and* hides from the check meant to catch it.
  if (data?.stop_reason === "max_tokens") {
    throw new TruncationError(
      `Response hit the ${body.max_tokens}-token ceiling and was cut off mid-sentence. Raise max_tokens — the partial text is not an answer.`
    );
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
  if (!text) {
    throw new Error("API returned no text content — raw response: " + JSON.stringify(data).slice(0, 300));
  }
  return text;
}

// Retries transient failures (network hiccups, "internal server error" style
// infra flakiness) up to 2 extra times with backoff. Does NOT retry forever —
// after 3 total attempts it gives up and surfaces the real error, so a
// genuinely broken call still fails loud rather than retrying silently forever.
// Permanent failures (a bad model ID, a malformed request) skip the backoff
// entirely and surface on the first attempt, since re-sending an identical bad
// request just delays the same error by three seconds.
async function callClaude(args) {
  const maxAttempts = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callClaudeOnce(args);
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
      if (attempt < maxAttempts) {
        await sleep(attempt * 1000); // 1s, then 2s before retrying
      }
    }
  }
  throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${lastError.message}`);
}

function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  try { return JSON.parse(match ? match[0] : cleaned); } catch { return null; }
}

function useGoogleFont() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

// ---------- Shared bits ----------
function Dial({ label, score, max = 10 }) {
  const pct = score / max;
  const color = pct >= 0.7 ? COLOR.green : pct >= 0.4 ? COLOR.gold : COLOR.red;
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke={COLOR.brassDim} strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - c * pct} transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 900ms ease" }} />
        <text x="32" y="37" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="15" fill={COLOR.vellum}>{score}</text>
      </svg>
      <div className="text-[10px] uppercase tracking-widest text-center" style={{ color: COLOR.vellumDim, fontFamily: "IBM Plex Mono, monospace" }}>{label}</div>
    </div>
  );
}

function Stamp({ overall }) {
  return (
    <div className="flex justify-center my-2">
      <div className="relative w-40 h-40 rounded-full flex items-center justify-center"
        style={{ border: `2px dashed ${COLOR.red}`, transform: "rotate(-8deg)", color: COLOR.red, fontFamily: "IBM Plex Mono, monospace" }}>
        <div className="absolute inset-2 rounded-full flex items-center justify-center text-center px-4" style={{ border: `1px solid ${COLOR.red}` }}>
          <span className="text-xs leading-tight uppercase tracking-wider">{overall}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Branch 1: Review pipeline ----------
function DocketRail({ activeKey, setActiveKey, status }) {
  return (
    <div className="relative pl-1">
      <div className="absolute left-[19px] top-3 bottom-3 w-px" style={{ background: COLOR.brassDim }} />
      {STAGES.map((s, i) => {
        const st = status[s.key];
        const isActive = activeKey === s.key;
        const dotColor = st === "done" ? COLOR.green : st === "running" ? COLOR.gold : st === "error" ? COLOR.red : COLOR.brassDim;
        const Icon = s.icon;
        return (
          <button key={s.key} onClick={() => setActiveKey(s.key)}
            className="relative flex items-start gap-3 w-full text-left py-3 pr-2 rounded-md transition-colors"
            style={{ background: isActive ? COLOR.panel : "transparent" }}>
            <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full shrink-0"
              style={{ background: COLOR.void, border: `1.5px solid ${dotColor}` }}>
              {st === "running" ? <Loader2 size={14} className="animate-spin" color={dotColor} /> : <Icon size={14} color={dotColor} />}
            </div>
            <div className="pt-1">
              <div className="text-[10px] tracking-widest" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>{String(i + 1).padStart(2, "0")}</div>
              <div className="text-sm" style={{ color: isActive ? COLOR.vellum : COLOR.vellumDim, fontFamily: "Fraunces, serif" }}>{s.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: COLOR.brassDim, fontFamily: "IBM Plex Mono, monospace" }}>{s.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function stageToText(stage, result) {
  if (stage.key === "judge" && result && !result.raw) {
    return `JUDGE VERDICT — ${stage.label}\n\nCompleteness: ${result.completeness?.score}/10 — ${result.completeness?.note}\nAccuracy: ${result.accuracy?.score}/10 — ${result.accuracy?.note}\nSkeptic value-add: ${result.skepticValueAdd?.score}/10 — ${result.skepticValueAdd?.note}\n\nOverall: ${result.overall}`;
  }
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

function downloadStageText(stage, result) {
  const body = stageToText(stage, result);
  const blob = new Blob([body], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stage.key}-${stage.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DocumentPanel({ stage, status, result, error }) {
  if (!stage) return null;
  const st = status[stage.key];
  const idx = STAGES.findIndex((s) => s.key === stage.key) + 1;
  return (
    <div className="relative rounded-lg p-8 min-h-[420px]" style={{ background: COLOR.vellum, color: "#2A2419" }}>
      <div className="absolute top-4 right-6 select-none pointer-events-none" style={{ fontFamily: "Fraunces, serif", fontSize: "120px", fontWeight: 300, color: "#00000009", lineHeight: 1 }}>
        {String(idx).padStart(2, "0")}
      </div>
      <div className="relative">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>{stage.sub}</div>
            <h2 className="text-2xl mb-5" style={{ fontFamily: "Fraunces, serif", fontWeight: 500 }}>{stage.label}</h2>
          </div>
          {st === "done" && result && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => downloadStageText(stage, result)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] uppercase tracking-wide"
                style={{ background: "#00000012", color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>
                <Download size={12} /> .txt
              </button>
            </div>
          )}
        </div>
        {st === "done" && result && (
          <p className="text-[10px] mb-3 -mt-1" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>
            Tap the box below, then long-press → Select All → Copy
          </p>
        )}
        {st === "waiting" || !st ? (
          <p className="text-sm italic opacity-60">Not run yet.</p>
        ) : st === "running" ? (
          <div className="flex items-center gap-2 text-sm opacity-70"><Loader2 size={14} className="animate-spin" /> Working…</div>
        ) : st === "error" ? (
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: COLOR.red }}>This stage failed.</p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: "#5A5342", fontFamily: "IBM Plex Mono, monospace" }}>{error || "No error detail captured."}</p>
          </div>
        ) : stage.key === "judge" && result ? (
          result.raw ? (
            <textarea readOnly value={result.raw} onFocus={(e) => e.target.select()}
              className="w-full text-sm leading-relaxed p-3 rounded"
              style={{ background: "#00000008", border: "none", resize: "vertical", minHeight: "260px", color: "#2A2419", fontFamily: "inherit" }} />
          ) : (
            <div>
              <Stamp overall={result?.completeness?.score >= 7 && result?.accuracy?.score >= 7 ? "Chain Intact" : "Gaps Found"} />
              <div className="flex justify-center gap-8 my-6">
                <Dial label="Complete" score={result.completeness?.score ?? 0} />
                <Dial label="Accurate" score={result.accuracy?.score ?? 0} />
                <Dial label="Skeptic value" score={result.skepticValueAdd?.score ?? 0} />
              </div>
              <div className="space-y-3 text-sm leading-relaxed border-t pt-4" style={{ borderColor: "#00000022" }}>
                <p><b>Completeness —</b> {result.completeness?.note}</p>
                <p><b>Accuracy —</b> {result.accuracy?.note}</p>
                <p><b>Skeptic value-add —</b> {result.skepticValueAdd?.note}</p>
                <p className="pt-2 italic">{result.overall}</p>
              </div>
            </div>
          )
        ) : (
          <textarea readOnly value={result} onFocus={(e) => e.target.select()}
            className="w-full text-sm leading-relaxed p-3 rounded"
            style={{ background: "#00000008", border: "none", resize: "vertical", minHeight: "260px", color: "#2A2419", fontFamily: "inherit" }} />
        )}
      </div>
    </div>
  );
}

function downloadFullReport(results, status) {
  const parts = STAGES.filter((s) => status[s.key] === "done" && results[s.key]).map((s) => {
    const r = results[s.key];
    let body;
    if (s.key === "judge" && r && !r.raw) {
      body = `Completeness: ${r.completeness?.score}/10 — ${r.completeness?.note}\nAccuracy: ${r.accuracy?.score}/10 — ${r.accuracy?.note}\nSkeptic value-add: ${r.skepticValueAdd?.score}/10 — ${r.skepticValueAdd?.note}\n\nOverall: ${r.overall}`;
    } else {
      body = typeof r === "string" ? r : JSON.stringify(r, null, 2);
    }
    return `${"=".repeat(60)}\nSTAGE ${STAGES.findIndex((x) => x.key === s.key) + 1}: ${s.label.toUpperCase()}\n${"=".repeat(60)}\n\n${body}\n`;
  });
  const blob = new Blob([parts.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "blackstone_carry_review_full.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReviewPipeline() {
  const [status, setStatus] = useState({});
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [activeKey, setActiveKey] = useState("retrieve");

  const setStageStatus = (key, val) => setStatus((s) => ({ ...s, [key]: val }));
  const setStageResult = (key, val) => setResults((r) => ({ ...r, [key]: val }));

  async function runPipeline() {
    setRunning(true); setError(null); setStatus({}); setResults({}); setActiveKey("retrieve");
    let currentStage = "retrieve";
    try {
      setStageStatus("retrieve", "running");
      const retrieverText = await callClaude({
        system: "You are a retrieval agent. Your ONLY job is to find Blackstone's actual disclosed carried interest / performance revenue terms — hurdle rate, catch-up mechanics, GP/LP split, crystallization or realization triggers. Restrict yourself to sec.gov and blackstone.com results only — ignore and do not cite any other domain. PREFER THE MOST RECENT FILING AVAILABLE — actively search for current-year filings, not just whatever surfaces first. Always state the filing's date/fiscal year explicitly (e.g. 'From Blackstone's FY2024 10-K') so staleness is visible to the reader — never present disclosure language without dating it. Before citing any source, VERIFY the document type in your label matches the document type in the actual URL/filing you're citing (e.g. don't label something '10-K' if the underlying document is actually a 10-Q) — a mismatched label is worse than no label. If the most recent filing's language differs from older filings, prefer and quote the recent version. If you cannot find primary-source text at those two domains, say so plainly and return nothing else. Do not explain or interpret — return the relevant raw disclosure text, then 'SOURCE:' followed by the URL.",
        prompt: "Find Blackstone's disclosed carried interest / performance revenue terms (hurdle, catch-up, GP/LP split, crystallization).",
        // The _20260209 variant adds dynamic filtering: Claude filters search
        // results before they reach the context window, which helps both the
        // accuracy and the token cost of this stage. Requires Sonnet 5, so it
        // is gated on the model change above.
        tools: [{ type: "web_search_20260209", name: "web_search" }],
      });
      setStageResult("retrieve", retrieverText); setStageStatus("retrieve", "done"); setActiveKey("mechanics");

      currentStage = "mechanics"; setStageStatus("mechanics", "running");
      const mechanicsText = await callClaude({
        system: "You are a technical accounting mechanics explainer. Given raw disclosure text about a PE firm's carried interest structure, produce a clear, structured explanation covering: hurdle rate, catch-up percentage and mechanics, GP/LP split above catch-up, and what triggers crystallization/realization of carry. Cite specific language from the source where it supports a claim. If the source doesn't cover a term, say so explicitly rather than filling in a generic assumption.",
        prompt: `Raw disclosure text:\n\n${retrieverText}\n\nExplain the carry mechanics.`,
      });
      setStageResult("mechanics", mechanicsText); setStageStatus("mechanics", "done"); setActiveKey("summarize");

      currentStage = "summarize"; setStageStatus("summarize", "running");
      const summaryText = await callClaude({
        system: "You are a neutral summarizer. You have NOT seen the original source — only the explanation below. Compress it into 3-5 tight sentences covering the key mechanics. You have no stake in defending its reasoning; compress faithfully and flag anything that seemed hedged or uncertain. CRITICAL: if the explanation gives different specific figures for different fund/vehicle types (e.g. 12.5% for one vehicle, 20% for another), preserve those as distinct attributed figures — do NOT blend multiple specific numbers into a single vague range (e.g. never write '10-20% depending on structure' when the source actually gave two distinct numbers for two distinct things). A specific number tied to the wrong thing is worse than no number.",
        prompt: `Explanation to summarize:\n\n${mechanicsText}`,
      });
      setStageResult("summarize", summaryText); setStageStatus("summarize", "done"); setActiveKey("skeptic");

      currentStage = "skeptic"; setStageStatus("skeptic", "running");
      const skepticText = await callClaude({
        system: "You are a skeptical second reviewer double-checking a colleague's work. You are given ONLY a summary (not the full filing or the original explainer's full reasoning) of a PE firm's carry disclosure. Identify what's asserted but not substantiated, ambiguous timing/trigger language, unclear fund-level vs deal-by-deal treatment, and what a real reviewer would flag before signing off. Be specific — do not just restate the summary in a suspicious tone.",
        prompt: `Summary to review:\n\n${summaryText}`,
      });
      setStageResult("skeptic", skepticText); setStageStatus("skeptic", "done"); setActiveKey("synthesis");

      currentStage = "synthesis"; setStageStatus("synthesis", "running");
      const synthesisText = await callClaude({
        system: "You write final reviewer memos. Combine a mechanics summary and a skeptic's open questions into one short memo, formatted like a real technical accounting reviewer memo: a 'Mechanics' section and an 'Open Questions / Risk Flags' section. Keep it tight and professional.",
        prompt: `Mechanics summary:\n\n${summaryText}\n\nSkeptic's open questions:\n\n${skepticText}`,
      });
      setStageResult("synthesis", synthesisText); setStageStatus("synthesis", "done"); setActiveKey("judge");

      currentStage = "judge"; setStageStatus("judge", "running");
      const judgeRaw = await callClaude({
        system: 'You are a fidelity judge. Compare a final synthesis memo against the ORIGINAL raw source text (not any intermediate agent output) and grade the pipeline on three axes, each 0-10: completeness, accuracy, skepticValueAdd. Respond ONLY with JSON, no preamble, no markdown fences: {"completeness": {"score": number, "note": string}, "accuracy": {"score": number, "note": string}, "skepticValueAdd": {"score": number, "note": string}, "overall": string}',
        prompt: `Original raw source text:\n\n${retrieverText}\n\nFinal synthesis memo:\n\n${synthesisText}`,
      });
      const judgeParsed = extractJSON(judgeRaw) || { raw: judgeRaw };
      setStageResult("judge", judgeParsed); setStageStatus("judge", "done");
    } catch (e) {
      setError(String(e));
      setStageStatus(currentStage, "error");
    } finally {
      setRunning(false);
    }
  }

  const activeStage = STAGES.find((s) => s.key === activeKey);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>Case File · Branch 1</div>
          <h1 className="text-4xl" style={{ color: COLOR.vellum, fontFamily: "Fraunces, serif", fontWeight: 500 }}>Blackstone Carry Disclosure Review</h1>
          <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: COLOR.vellumDim }}>Six agents, one chain of custody — from raw source to a graded verdict on what survived the handoffs.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {Object.values(status).some((s) => s === "done") && (
            <button onClick={() => downloadFullReport(results, status)} className="flex items-center gap-2 px-4 py-3 rounded-md text-sm"
              style={{ background: "transparent", color: COLOR.brass, border: `1px solid ${COLOR.brassDim}`, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
              <Download size={14} /> SAVE ALL
            </button>
          )}
          <button onClick={runPipeline} disabled={running} className="px-5 py-3 rounded-md text-sm"
            style={{ background: COLOR.gold, color: COLOR.void, opacity: running ? 0.55 : 1, cursor: running ? "default" : "pointer", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
            {running ? "RUNNING…" : "RUN PIPELINE"}
          </button>
        </div>
      </div>
      {error && <div className="mb-6 px-4 py-3 rounded-md text-sm" style={{ background: "#2A1815", color: "#D98878", border: `1px solid ${COLOR.red}` }}>{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <DocketRail activeKey={activeKey} setActiveKey={setActiveKey} status={status} />
        <DocumentPanel stage={activeStage} status={status} result={results[activeKey]} error={error} />
      </div>
    </div>
  );
}

// ---------- Branch 2: Carry-for-dummies calculator ----------
function StepRow({ n, label, formula, value }) {
  return (
    <div className="flex gap-4 py-3 border-b" style={{ borderColor: "#00000015" }}>
      <div className="text-xs mt-0.5 shrink-0" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>{String(n).padStart(2, "0")}</div>
      <div className="flex-1">
        <div className="text-sm" style={{ fontFamily: "Fraunces, serif" }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ fontFamily: "IBM Plex Mono, monospace", color: "#5A5342" }}>{formula}</div>
      </div>
      <div className="text-sm shrink-0" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{value}</div>
    </div>
  );
}

function WarningBanner({ warnings }) {
  if (!warnings.length) return null;
  return (
    <div className="mb-5 rounded-md px-4 py-3" style={{ background: "#C9A2271F", border: `1px solid ${COLOR.gold}` }}>
      <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ fontFamily: "IBM Plex Mono, monospace", color: "#8A6D0B" }}>
        Model limitation
      </div>
      {warnings.map((w, i) => (
        <p key={i} className="text-xs leading-relaxed" style={{ color: "#4A4335" }}>{w}</p>
      ))}
    </div>
  );
}

function CarryCalculator() {
  const computable = FUNDS.filter(isComputable);
  const uncomputable = FUNDS.filter((f) => !isComputable(f));
  const [selected, setSelected] = useState(computable[2]?.name || computable[0]?.name);
  const [narrative, setNarrative] = useState("");
  const [narrLoading, setNarrLoading] = useState(false);
  const [narrError, setNarrError] = useState(null);

  const fund = FUNDS.find((f) => f.name === selected);
  const c = fund && isComputable(fund) ? computeCarry(fund) : null;
  const warnings = fund && c ? getWarnings(fund, c) : [];

  async function explainForDummy() {
    if (!fund || !c) return;
    setNarrLoading(true); setNarrError(null); setNarrative("");
    try {
      const text = await callClaude({
        system: "You explain private equity carried interest math to someone with zero finance background. You are given EXACT pre-computed numbers — do not recompute or alter them, just narrate what they mean in plain, friendly language, step by step, using an analogy if it helps. Keep it under 200 words. If a MODEL LIMITATION is listed, say so plainly in your explanation — do not present the carry figure as a reliable estimate when one is present.",
        prompt: `Fund: ${fund.name} (${fund.period}, ${fund.status})
Committed capital: $${fund.committed}B, Available (undrawn): $${fund.available}B
Paid-in capital: $${c.paidIn.toFixed(2)}B
Reported MOIC: ${fund.moic}x → Total value: $${c.totalValue.toFixed(2)}B
Profit: $${c.profit.toFixed(2)}B
Years since deployment (approx.): ${c.years.toFixed(1)}
Compounded 8% hurdle owed to LPs: $${c.hurdleAmt.toFixed(2)}B
GP catch-up (100% until GP holds 20% of profit above return of capital): $${c.catchUp.toFixed(2)}B
GP's 20% share above catch-up: $${c.gpSplit.toFixed(2)}B
Total GP carry: $${c.gpTotal.toFixed(2)}B
LP total proceeds: $${c.lpTotal.toFixed(2)}B
Effective carry as % of total profit: ${(c.effectivePct * 100).toFixed(1)}%${warnings.length ? ` (NOTE: the user does NOT see this number — it is displayed as "n/m", not meaningful, because of the limitation below)` : ""}
${warnings.length ? `\nMODEL LIMITATION: ${warnings.join(" ")}\n` : ""}
Explain this like I'm a dummy.`,
      });
      setNarrative(text);
    } catch (e) {
      setNarrError(String(e));
    } finally {
      setNarrLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>Case File · Branch 2</div>
          <h1 className="text-4xl" style={{ color: COLOR.vellum, fontFamily: "Fraunces, serif", fontWeight: 500 }}>Carry-for-Dummies Calculator</h1>
          <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: COLOR.vellumDim }}>
            Deterministic waterfall math per fund — 8% hurdle, 100% catch-up, 20% carry, European whole-fund. Years-to-hurdle runs from deployment midpoint, capped at 12 years (typical full fund life) so mature/realized funds aren't penalized for a hurdle compounding all the way to today. Standard assumptions, not Blackstone's actual disclosed terms.
          </p>
        </div>
        <button onClick={downloadCSV} className="flex items-center gap-2 px-5 py-3 rounded-md text-sm shrink-0"
          style={{ background: COLOR.gold, color: COLOR.void, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
          <Download size={14} /> DOWNLOAD CSV — ALL FUNDS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>Select fund</div>
          <div className="relative">
            <select value={selected} onChange={(e) => { setSelected(e.target.value); setNarrative(""); }}
              className="w-full appearance-none rounded-md px-3 py-2.5 text-sm pr-8"
              style={{ background: COLOR.panel, color: COLOR.vellum, border: `1px solid ${COLOR.panelEdge}`, fontFamily: "IBM Plex Mono, monospace" }}>
              <optgroup label="Computable">
                {computable.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </optgroup>
              <optgroup label="Insufficient data">
                {uncomputable.map((f) => <option key={f.name} value={f.name} disabled>{f.name} — n/a</option>)}
              </optgroup>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 pointer-events-none" color={COLOR.brass} />
          </div>

          <div className="mt-4 text-xs leading-relaxed space-y-1" style={{ color: COLOR.vellumDim, fontFamily: "IBM Plex Mono, monospace" }}>
            <div>{fund?.period}</div>
            <div>{fund?.status}</div>
          </div>

          <button onClick={explainForDummy} disabled={!c || narrLoading}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm"
            style={{ background: c ? COLOR.brass : COLOR.brassDim, color: COLOR.void, opacity: narrLoading ? 0.6 : 1, cursor: c && !narrLoading ? "pointer" : "default", fontFamily: "IBM Plex Mono, monospace" }}>
            {narrLoading ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
            {narrLoading ? "EXPLAINING…" : "EXPLAIN FOR A DUMMY"}
          </button>
        </div>

        <div className="rounded-lg p-8" style={{ background: COLOR.vellum, color: "#2A2419" }}>
          {!c ? (
            <p className="text-sm italic opacity-70">
              {fund?.name} doesn't have enough public data for a time-based calc ({fund?.period === "Various" ? "multiple vintages, no single deployment date" : "no reported MOIC yet"}).
            </p>
          ) : (
            <>
              <h2 className="text-2xl mb-1" style={{ fontFamily: "Fraunces, serif", fontWeight: 500 }}>{fund.name}</h2>
              <p className="text-xs mb-5" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>
                8% hurdle · 100% catch-up · 20% carry — standard assumptions, not Blackstone's actual terms
              </p>

              <WarningBanner warnings={warnings} />

              <div>
                <StepRow n={1} label="Paid-in capital" formula={`$${fund.committed}B committed − $${fund.available}B available`} value={`$${c.paidIn.toFixed(2)}B`} />
                <StepRow n={2} label="Total value" formula={`${fund.moic}x MOIC × $${c.paidIn.toFixed(2)}B paid-in`} value={`$${c.totalValue.toFixed(2)}B`} />
                <StepRow n={3} label="Profit" formula={`$${c.totalValue.toFixed(2)}B total value − $${c.paidIn.toFixed(2)}B paid-in`} value={`$${c.profit.toFixed(2)}B`} />
                <StepRow n={4} label="Years since deployment (approx.)" formula={`June 2026 − midpoint of ${fund.period}`} value={`${c.years.toFixed(1)} yrs`} />
                <StepRow n={5} label="Compounded hurdle owed to LPs" formula={`$${c.paidIn.toFixed(2)}B × (1.08^${c.years.toFixed(1)} − 1)`} value={`$${c.hurdleAmt.toFixed(2)}B`} />
                <StepRow n={6} label="GP catch-up" formula={`min(profit − hurdle, hurdle × 0.25)`} value={`$${c.catchUp.toFixed(2)}B`} />
                <StepRow n={7} label="80/20 split above catch-up (GP side)" formula={`(profit − hurdle − catch-up) × 20%`} value={`$${c.gpSplit.toFixed(2)}B`} />
                <StepRow n={8} label="Total GP carry" formula={`catch-up + GP's 20% share`} value={`$${c.gpTotal.toFixed(2)}B`} />
                <StepRow n={9} label="LP total proceeds" formula={`paid-in + hurdle + LP's 80% share`} value={`$${c.lpTotal.toFixed(2)}B`} />
              </div>

              <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: "#00000022" }}>
                <span className="text-sm" style={{ fontFamily: "Fraunces, serif" }}>Effective carry (% of profit)</span>
                {warnings.length ? (
                  <span className="text-right">
                    <span className="block text-lg" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>n/m</span>
                    <span className="block text-[10px] uppercase tracking-widest" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>
                      not meaningful — see above
                    </span>
                  </span>
                ) : (
                  <span className="text-lg" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.red }}>{(c.effectivePct * 100).toFixed(1)}%</span>
                )}
              </div>

              {narrError && <p className="text-sm mt-4" style={{ color: COLOR.red }}>{narrError}</p>}
              {narrative && (
                <div className="mt-6 pt-5 border-t text-sm leading-relaxed whitespace-pre-wrap" style={{ borderColor: "#00000022" }}>
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>For a dummy</div>
                  {narrative}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- App shell with tabs ----------
export default function App() {
  useGoogleFont();
  const [tab, setTab] = useState("review");

  return (
    <div className="min-h-screen w-full" style={{ background: COLOR.void }}>
      <div className="max-w-5xl mx-auto px-5 pt-8">
        <div className="flex gap-1 mb-2">
          {[
            { key: "review", label: "Branch 1 — Disclosure Review" },
            { key: "calc", label: "Branch 2 — Carry Calculator" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-xs rounded-t-md"
              style={{
                background: tab === t.key ? COLOR.void : "transparent",
                color: tab === t.key ? COLOR.gold : COLOR.brass,
                border: `1px solid ${tab === t.key ? COLOR.panelEdge : "transparent"}`,
                borderBottom: tab === t.key ? `1px solid ${COLOR.void}` : "none",
                marginBottom: tab === t.key ? "-1px" : "0",
                fontFamily: "IBM Plex Mono, monospace",
                letterSpacing: "0.04em",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: COLOR.panelEdge }} />
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        {tab === "review" ? <ReviewPipeline /> : <CarryCalculator />}
      </div>
    </div>
  );
}
