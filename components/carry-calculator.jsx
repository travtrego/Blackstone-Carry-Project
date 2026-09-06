"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Calculator, Download, ChevronDown } from "lucide-react";
import { callClaude } from "@/lib/claude-client";
import { FUNDS, MODEL_NOTICE, isComputable, computeCarry, getWarnings, toCSV } from "@/lib/carry";
import { COLOR } from "@/lib/theme";

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

export function CarryCalculator() {
  const computable = FUNDS.filter(isComputable);
  const uncomputable = FUNDS.filter((f) => !isComputable(f));
  const [selected, setSelected] = useState(computable[2]?.name || computable[0]?.name);
  const [narrative, setNarrative] = useState("");
  const [narrLoading, setNarrLoading] = useState(false);
  const [narrError, setNarrError] = useState(null);
  const narrativeRequest = useRef(null);
  useEffect(() => () => narrativeRequest.current?.abort(), []);

  const fund = FUNDS.find((f) => f.name === selected);
  const c = fund && isComputable(fund) ? computeCarry(fund) : null;
  const warnings = fund && c ? getWarnings(fund, c) : [];

  async function explainForDummy() {
    if (!fund || !c || narrativeRequest.current) return;
    const controller = new AbortController();
    narrativeRequest.current = controller;
    setNarrLoading(true); setNarrError(null); setNarrative("");
    try {
      const text = await callClaude({
        signal: controller.signal,
        system: "Explain this hypothetical carry model to a beginner in under 200 words. Narrate the supplied pre-computed numbers; do not recompute or alter them. All amounts are rounded: $0.00B may be a small positive amount, not exactly zero. Always say these are model assumptions, not Blackstone's actual terms or cash paid. A hurdle is a priority for distributing available proceeds, NEVER a guaranteed return or savings-account interest. The 12-year cap is an approximation, not an observed fund duration. Do not infer that net IRR proves an actual hurdle was satisfied. Include MODEL LIMITATION warnings and never present modeled carry as reliable actual economics.",
        prompt: `Fund: ${fund.name} (${fund.period}, ${fund.status})
Committed capital: $${fund.committed}B, Available (undrawn): $${fund.available}B
Paid-in capital: $${c.paidIn.toFixed(2)}B
Reported MOIC: ${fund.moic}x → Total value: $${c.totalValue.toFixed(2)}B
Profit: $${c.profit.toFixed(2)}B
Years since deployment (approx.): ${c.years.toFixed(1)}
Modeled 8% hurdle threshold (not a guaranteed payment): $${c.hurdleAmt.toFixed(2)}B
GP catch-up (100% until GP holds 20% of profit above return of capital): $${c.catchUp.toFixed(2)}B
GP's 20% share above catch-up: $${c.gpSplit.toFixed(2)}B
Total GP carry: $${c.gpTotal.toFixed(2)}B
Modeled LP share of total value (not verified cash distributions): $${c.lpTotal.toFixed(2)}B
Effective carry as % of total profit: ${(c.effectivePct * 100).toFixed(1)}%${warnings.length ? ` (NOTE: the user does NOT see this number — it is displayed as "n/m", not meaningful, because of the limitation below)` : ""}
MODEL ASSUMPTIONS: ${MODEL_NOTICE}
${warnings.length ? `\nMODEL LIMITATION: ${warnings.join(" ")}\n` : ""}
Explain this like I'm a dummy.`,
      });
      if (!controller.signal.aborted) setNarrative(text);
    } catch (e) {
      if (!controller.signal.aborted) setNarrError(e.message);
    } finally {
      if (narrativeRequest.current === controller) {
        narrativeRequest.current = null;
        setNarrLoading(false);
      }
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] mb-2" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>Case File · Branch 2</div>
          <h1 className="text-4xl" style={{ color: COLOR.vellum, fontFamily: "Fraunces, serif", fontWeight: 500 }}>Carry-for-Dummies Calculator</h1>
          <p className="text-sm mt-2 max-w-xl leading-relaxed" style={{ color: COLOR.vellumDim }}>
            Deterministic waterfall math per fund — an assumed 8% hurdle, 100% catch-up, 20% carry, European whole-fund. Timing is approximated from the deployment midpoint and capped at 12 years; it is not measured from actual cash flows. Teaching assumptions, not Blackstone&apos;s actual disclosed terms.
          </p>
        </div>
        <button onClick={downloadCSV} className="flex items-center gap-2 px-5 py-3 rounded-md text-sm shrink-0"
          style={{ background: COLOR.gold, color: COLOR.void, fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.05em" }}>
          <Download size={14} /> DOWNLOAD CSV — ALL FUNDS
        </button>
      </div>

      <details className="mb-5 text-sm" style={{ color: COLOR.vellumDim }}><summary className="cursor-pointer">Illustrative model — unverified input table, not actual carry payable. View assumptions.</summary><p className="mt-2 leading-relaxed">{MODEL_NOTICE}</p></details>
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: COLOR.brass, fontFamily: "IBM Plex Mono, monospace" }}>Select fund</div>
          <div className="relative">
            <select aria-label="Select fund" disabled={narrLoading} value={selected} onChange={(e) => { setSelected(e.target.value); setNarrative(""); setNarrError(null); }}
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
              {fund?.name} doesn&apos;t have enough public data for a time-based calc ({fund?.period === "Various" ? "multiple vintages, no single deployment date" : "no reported MOIC yet"}).
            </p>
          ) : (
            <>
              <h2 className="text-2xl mb-1" style={{ fontFamily: "Fraunces, serif", fontWeight: 500 }}>{fund.name}</h2>
              <p className="text-xs mb-5" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLOR.brass }}>
                8% hurdle · 100% catch-up · 20% carry — standard assumptions, not Blackstone&apos;s actual terms
              </p>

              <WarningBanner warnings={warnings} />

              <div>
                <StepRow n={1} label="Paid-in capital" formula={`$${fund.committed}B committed − $${fund.available}B available`} value={`$${c.paidIn.toFixed(2)}B`} />
                <StepRow n={2} label="Total value" formula={`${fund.moic}x MOIC × $${c.paidIn.toFixed(2)}B paid-in`} value={`$${c.totalValue.toFixed(2)}B`} />
                <StepRow n={3} label="Profit" formula={`$${c.totalValue.toFixed(2)}B total value − $${c.paidIn.toFixed(2)}B paid-in`} value={`$${c.profit.toFixed(2)}B`} />
                <StepRow n={4} label="Years since deployment (approx.)" formula={`June 2026 − midpoint of ${fund.period}`} value={`${c.years.toFixed(1)} yrs`} />
                <StepRow n={5} label="Modeled hurdle threshold (not guaranteed)" formula={`$${c.paidIn.toFixed(2)}B × (1.08^${c.years.toFixed(1)} − 1)`} value={`$${c.hurdleAmt.toFixed(2)}B`} />
                <StepRow n={6} label="GP catch-up" formula={`max(0, min(profit − hurdle, hurdle × 0.25))`} value={`$${c.catchUp.toFixed(2)}B`} />
                <StepRow n={7} label="80/20 split above catch-up (GP side)" formula={`max(0, profit − hurdle − catch-up) × 20%`} value={`$${c.gpSplit.toFixed(2)}B`} />
                <StepRow n={8} label="Total GP carry" formula={`catch-up + GP's 20% share`} value={`$${c.gpTotal.toFixed(2)}B`} />
                <StepRow n={9} label="LP total proceeds" formula={`total value − total GP carry`} value={`$${c.lpTotal.toFixed(2)}B`} />
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
