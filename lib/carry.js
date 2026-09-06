// ---------- Fund reference data (from uploaded table, data as of 6/30/2026) ----------
// computable = has committed, available, moic, and a resolvable deployment year
//
// clearsHurdle is a legacy name for a hand-set model-consistency warning flag.
// A table IRR at or above 12% can conflict with this simplified zero-carry model;
// it does NOT establish that the actual contractual hurdle was satisfied.
// The original rule used to populate it:
//   - 12%, not 8%, because IRR and hurdle-on-paid-in aren't computed the same
//     way — a fund at 8-9% is genuinely too close to call (see eval case 3,
//     which expects BCP V at 8% IRR to show ~zero carry, correctly).
//   - Omitted for any IRR the source labels "(early)", "(very early)",
//     "not meaningful", or "early history". An unrealized early-life IRR is not
//     evidence that a hurdle was cleared.
// Absence of the field therefore means "not clearly above the hurdle", not
// "nobody checked". It is a human judgment on purpose: parsing these IRR strings
// in code would fail silently on a label like "(4%)" or "8-12%".
export const FUNDS = [
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

export const MODEL_NOTICE = "Illustrative model only, not actual carry payable. Assumes an 8% compounded hurdle, 100% catch-up and 20% carry; the hurdle is a distribution priority, not a guaranteed return. Paid-in is approximated as committed minus available capital; MOIC times that proxy is not verified distributable cash. Timing is a lump sum at the deployment midpoint, floored at 0.1 and capped at 12 years. June 30, 2026 input table has no retained original-source document and has not been independently verified.";

export function isComputable(f) {
  return [f.start, f.end, f.committed, f.available, f.moic].every(Number.isFinite) &&
    f.end >= f.start && f.available >= 0 && f.committed > f.available && f.moic >= 0;
}

export function computeCarry(f) {
  if (!isComputable(f)) throw new Error("Insufficient or invalid fund data.");
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
export function getWarnings(f, c) {
  const warnings = [];
  if (c.years <= MIN_YEARS) {
    warnings.push(
      `${f.name} is still early in its deployment window — the midpoint of ${f.period} falls at or after the June 2026 report date, so this model accrues almost no hurdle (${(c.hurdleAmt * 1000).toFixed(0)}M on $${c.paidIn.toFixed(2)}B paid-in). This timing approximation can overstate modeled carry. Total value is not verified cash available for distribution; the result is not meaningful as an estimate of carry payable.`
    );
  }
  // Potential inconsistency, not proof of actual carry: net IRR and a contractual
  // waterfall are not interchangeable, and source cash-flow timing is missing.
  if (f.clearsHurdle && c.effectivePct < 0.005) {
    warnings.push(
      `The imported table lists ${f.name} at ${f.irr} net IRR, yet this model computes essentially no carry. It treats all paid-in capital as one lump sum at the midpoint of ${f.period}, compounding a ${c.years.toFixed(1)}-year hurdle ($${c.hurdleAmt.toFixed(2)}B) against $${c.profit.toFixed(2)}B of profit. Net IRR alone does not prove that a contractual hurdle was met. Without cash-flow timing and actual fund terms, this apparent inconsistency cannot be resolved; do not use the figure as an estimate.`
    );
  }
  return warnings;
}

// Columns mirror the nine waterfall steps shown in the UI, in the same order, so
// the export and the on-screen calculation can be reconciled line for line.
export const CSV_HEADER = [
  "Fund", "Period", "Committed ($B)", "Available ($B)", "Paid-in ($B)", "MOIC",
  "Reported net IRR", "Total value ($B)", "Profit ($B)", "Years elapsed",
  "Modeled hurdle threshold ($B)", "GP catch-up ($B)", "GP 80/20 split ($B)",
  "GP carry total ($B)", "LP proceeds ($B)", "Effective carry %", "Status", "Warnings",
];

export function toCSV() {
  const rows = [CSV_HEADER];
  FUNDS.forEach((f) => {
    if (!isComputable(f)) {
      rows.push([
        f.name, f.period, f.committed ?? "n/d", f.available ?? "n/d", "n/a", f.moic ?? "n/a",
        f.irr ?? "n/a", "n/a", "n/a", "n/a",
        "n/a", "n/a", "n/a",
        "n/a", "n/a", "insufficient data", f.status, MODEL_NOTICE,
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
      [MODEL_NOTICE, ...w].join(" "),
    ]);
  });
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
