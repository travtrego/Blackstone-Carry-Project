"use client";

import { useEffect, useRef, useState } from "react";
import { Search, FileText, Scissors, ShieldAlert, FileCheck, Gavel, Loader2, Download } from "lucide-react";
import { callClaude } from "@/lib/claude-client";
import { executeReview } from "@/lib/review-flow";
import { COLOR } from "@/lib/theme";

const STAGES = [
  { key: "retrieve", label: "Retrieve source", sub: "web_search · sec.gov, blackstone.com", icon: Search },
  { key: "mechanics", label: "Mechanics explainer", sub: "hurdle, catch-up, split, triggers", icon: FileText },
  { key: "summarize", label: "Neutral summarizer", sub: "blind compression", icon: Scissors },
  { key: "skeptic", label: "Disclosure skeptic", sub: "summary only, no raw text", icon: ShieldAlert },
  { key: "synthesis", label: "Synthesis memo", sub: "mechanics + open questions", icon: FileCheck },
  { key: "judge", label: "Judge", sub: "memo graded vs. raw source", icon: Gavel },
];

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
    <div className="relative pl-1 flex md:block gap-2 overflow-x-auto md:overflow-visible pb-2">
      <div className="hidden md:block absolute left-[19px] top-3 bottom-3 w-px" style={{ background: COLOR.brassDim }} />
      {STAGES.map((s, i) => {
        const st = status[s.key];
        const isActive = activeKey === s.key;
        const dotColor = st === "done" ? COLOR.green : st === "running" ? COLOR.gold : st === "error" ? COLOR.red : COLOR.brassDim;
        const Icon = s.icon;
        return (
          <button key={s.key} onClick={() => setActiveKey(s.key)} aria-current={isActive ? "step" : undefined}
            className="relative flex items-start gap-3 w-44 md:w-full shrink-0 text-left py-3 pr-2 rounded-md transition-colors"
            style={{ background: isActive ? COLOR.panel : "transparent" }}>
            <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-full shrink-0"
              style={{ background: COLOR.void, border: `1.5px solid ${dotColor}` }}>
              {st === "running" ? <Loader2 size={14} className="animate-spin" color={dotColor} /> : <Icon size={14} color={dotColor} />}
            </div>
            <div className="pt-1">
              <div className="text-[10px] tracking-widest" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>{String(i + 1).padStart(2, "0")}</div>
              <div className="text-sm" style={{ color: isActive ? COLOR.vellum : COLOR.vellumDim, fontFamily: "Fraunces, serif" }}>{s.label}</div>
              <div className="hidden md:block text-xs mt-0.5" style={{ color: COLOR.vellumDim, fontFamily: "IBM Plex Mono, monospace" }}>{s.sub}</div>
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
            <textarea aria-label="Judge raw response" readOnly value={result.raw} onFocus={(e) => e.target.select()}
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
          <textarea aria-label={stage.label + " result"} readOnly value={result} onFocus={(e) => e.target.select()}
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

export function ReviewPipeline() {
  const [status, setStatus] = useState({});
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [activeKey, setActiveKey] = useState("retrieve");

  const setStageStatus = (key, val) => setStatus((s) => ({ ...s, [key]: val }));
  const setStageResult = (key, val) => setResults((r) => ({ ...r, [key]: val }));

  const runRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentStage, setCurrentStage] = useState(null);
  const [timings, setTimings] = useState({});
  const [ready, setReady] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Server unavailable")))
      .then((data) => setReady(Boolean(data.ready)))
      .catch(() => { if (!controller.signal.aborted) setReady(false); });
    return () => { controller.abort(); runRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  async function runPipeline(resume = false) {
    if (runRef.current) return;
    const controller = new AbortController();
    runRef.current = controller;
    const saved = resume ? Object.fromEntries(Object.entries(results).filter(([key]) => status[key] === "done")) : {};
    setRunning(true); setElapsed(0); setError(null);
    setResults(saved);
    setStatus(Object.fromEntries(Object.keys(saved).map((key) => [key, "done"])));
    if (!resume) setTimings({});
    let stage = "retrieve", stageStarted = Date.now();
    try {
      await executeReview({
        completed: saved, signal: controller.signal, call: callClaude,
        onStart: (key) => {
          stage = key; stageStarted = Date.now();
          setCurrentStage(key); setActiveKey(key); setStageStatus(key, "running");
        },
        onDone: (key, value) => {
          const duration = ((Date.now() - stageStarted) / 1000).toFixed(1);
          setStageResult(key, value); setStageStatus(key, "done");
          setTimings((t) => ({ ...t, [key]: duration }));
        },
      });
      setCurrentStage(null);
    } catch (e) {
      setError(controller.signal.aborted ?
        "Run cancelled. Completed stages are kept. An upstream request may take until its deadline to stop." :
        e.message);
      setStageStatus(stage, "error");
      setActiveKey(stage);
    } finally {
      if (runRef.current === controller) {
        runRef.current = null; setRunning(false);
      }
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
          <button onClick={() => runPipeline(false)} disabled={running || ready !== true} className="px-5 py-3 rounded-md text-sm"
            style={{ background: COLOR.gold, color: COLOR.void, opacity: running ? 0.55 : 1, cursor: running ? "default" : "pointer", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
            {running ? "RUNNING…" : "RUN PIPELINE"}
          </button>
        </div>
      </div>
      {ready === false && <p role="alert" className="mb-4 text-sm" style={{ color: COLOR.gold }}>AI is not ready. Check the saved settings, start the local server, then refresh this page.</p>}
      <div className="mb-4 flex flex-wrap gap-3 items-center text-sm" style={{ color: COLOR.vellumDim }}>
        {running && <><output aria-live="polite">{STAGES.find((s) => s.key === currentStage)?.label} · {elapsed}s elapsed · one request, no automatic retries</output><button onClick={() => runRef.current?.abort()} className="px-4 py-2 border rounded" style={{ borderColor: COLOR.brass }}>CANCEL RUN</button></>}
        {!running && error && <button onClick={() => runPipeline(true)} className="px-4 py-2 border rounded" style={{ borderColor: COLOR.brass }}>RETRY FAILED STAGE</button>}
        {!running && status.judge === "done" && <output>Review complete — all six stages finished.</output>}
      </div>
      <p className="mb-4 text-xs" style={{ color: COLOR.vellumDim }}>Live AI review; API charges apply. Search is limited to two queries. Retrieved excerpts are AI-assembled, not a verified full filing. The judge checks the memo against those excerpts only. Save results before closing this tab.</p>
      {Object.keys(timings).length > 0 && <p className="mb-4 text-xs" style={{ color: COLOR.vellumDim }}>{STAGES.filter((s) => timings[s.key]).map((s) => s.label + ": " + timings[s.key] + "s").join(" · ")}</p>}
      {error && <div role="alert" className="mb-6 px-4 py-3 rounded-md text-sm" style={{ background: "#2A1815", color: "#D98878", border: `1px solid ${COLOR.red}` }}>{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <DocketRail activeKey={activeKey} setActiveKey={setActiveKey} status={status} />
        <DocumentPanel stage={activeStage} status={status} result={results[activeKey]} error={error} />
      </div>
    </div>
  );
}
