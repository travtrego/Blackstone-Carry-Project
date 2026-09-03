#!/usr/bin/env node
//
// Runs evals/eval_set.md against the real implementation.
//
//   node evals/run-evals.mjs
//
// Exits non-zero if anything fails, so it works as a pre-commit or CI check.
// No dependencies and no build step, deliberately — the project has no
// package.json and adding one would imply a toolchain that doesn't exist.
//
// WHY IT EXTRACTS RATHER THAN IMPORTS
// carry-review.jsx has to stay a single self-contained file, because that is
// what gets pasted into the artifact sandbox to run. It can't be imported
// directly here: it opens with a React import and contains JSX, neither of
// which node will parse. The three alternatives were to duplicate the maths
// into this file (two copies of the truth, guaranteed to drift), to split the
// maths into its own module (breaks the single-file constraint), or to slice
// the pure-maths region out of the source at runtime. This does the third. The
// region between the two markers below is plain JavaScript with no React, no
// JSX and no DOM access, so it evaluates as a module unmodified.
//
// If someone reorders the file so a marker moves, this fails immediately with a
// clear message rather than silently testing the wrong thing.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "..", "carry-review.jsx");

const START_MARKER = "const FUNDS = [";
// Matches the opening paren, not "()", so the marker survives downloadCSV
// gaining parameters. It gained them when Branch 2 learned to export a
// refreshed table, and an end marker that breaks on a signature change is a
// marker that will keep breaking.
const END_MARKER = "function downloadCSV(";
const EXPORTS = "FUNDS, isComputable, computeCarry, getWarnings, toCSV, CSV_HEADER, normalizeRefreshedFunds, asOfToDecimal, asOfLabel, BASELINE_AS_OF, BASELINE_PROVENANCE, REPORT_DATE_DEC";

async function loadMath() {
  const src = await readFile(SOURCE, "utf8");
  const start = src.indexOf(START_MARKER);
  const end = src.indexOf(END_MARKER);

  if (start === -1) throw new Error(`Could not find "${START_MARKER}" in ${SOURCE}. Did the file get reorganised?`);
  if (end === -1) throw new Error(`Could not find "${END_MARKER}" in ${SOURCE}. Did the file get reorganised?`);
  if (end < start) throw new Error(`"${END_MARKER}" appears before "${START_MARKER}" in ${SOURCE}. The extracted region would be empty or inverted.`);

  const code = src.slice(start, end) + `\nexport { ${EXPORTS} };\n`;
  return import("data:text/javascript," + encodeURIComponent(code));
}

// ---------- tiny assertion harness ----------
let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

function section(name) {
  console.log(`\n${name}`);
}

// Splits one line produced by toCSV(). Every field is quoted and internal
// quotes are doubled, so this only has to reverse that.
function parseCsvLine(line) {
  return line.slice(1, -1).split('","').map((v) => v.replace(/""/g, '"'));
}

const pct = (c) => +(c.effectivePct * 100).toFixed(1);

// ---------- run ----------
const {
  FUNDS, isComputable, computeCarry, getWarnings, toCSV, CSV_HEADER,
  normalizeRefreshedFunds, asOfToDecimal, BASELINE_AS_OF, BASELINE_PROVENANCE, REPORT_DATE_DEC,
} = await loadMath();
const fund = (name) => {
  const f = FUNDS.find((x) => x.name === name);
  if (!f) throw new Error(`No fund named ${name} — the reference data changed.`);
  return f;
};

console.log("Blackstone carry calculator — eval set");
console.log(`source: carry-review.jsx (${START_MARKER} … ${END_MARKER})`);

section("Answer key (evals/eval_set.md)");

// 1. BCP IV — 2.9x MOIC, 36% net IRR, fully realised. Expect carry close to the
//    20% cap: a fund returning nearly 3x at 36% blows past any normal hurdle.
{
  const c = computeCarry(fund("BCP IV"));
  check("1  BCP IV — strong carry near the cap", pct(c) >= 19.9, `${pct(c)}%`);
}

// 2. BXG I — 1.2x MOIC, 2% net IRR. Expect zero: 2% doesn't come close to an 8%
//    hurdle, so LPs haven't had their preferred return and the GP earns nothing.
{
  const c = computeCarry(fund("BXG I"));
  check("2  BXG I — zero carry", pct(c) === 0, `${pct(c)}%`);
}

// 3. BCP V — 1.9x MOIC, 8% net IRR. Expect zero or very low: 8% is *at* the
//    hurdle, not above it, so no meaningful carry should accrue above it.
{
  const c = computeCarry(fund("BCP V"));
  check("3  BCP V — zero or very low", pct(c) < 0.5, `${pct(c)}%`);
}

// 4. Energy Transition IV — 2.0x MOIC deployed very recently. Expect high carry
//    despite little elapsed time: barely any hurdle has accrued for 2x to clear.
{
  const c = computeCarry(fund("Energy Transition IV"));
  check("4  Energy Transition IV — high despite little time", pct(c) >= 19.9, `${pct(c)}%`);
}

// 5. Floor case. A fund at exactly 1.0x has no profit, so there is nothing to
//    take carry from. If this ever returns non-zero the formula is broken.
{
  const c = computeCarry({ start: 2015, end: 2020, committed: 10, available: 0, moic: 1.0 });
  check("5  1.0x MOIC — exactly zero", c.profit === 0 && c.gpTotal === 0, `profit $${c.profit}B, carry $${c.gpTotal}B`);
}

// 6. An old, fully realised fund should not look like a failure just because
//    decades passed. NOTE this is not asserted as "carry > 0" — see below.
{
  const f = fund("BCP I-III");
  const c = computeCarry(f);
  const warned = getWarnings(f, c).length > 0;
  check(
    "6  BCP I-III — not presented as a silent zero",
    warned,
    `computes ${pct(c)}%, flagged=${warned}`
  );
  if (warned) {
    console.log("        note: satisfied by disclosure, not by a corrected number. The");
    console.log("        computed figure is still 0.00 and cannot be fixed without");
    console.log("        capital-call timing that isn't public. What the fix guarantees");
    console.log("        is that the zero is never shown as an answer.");
  }
}

// 7. 20% is a structural ceiling in a standard carry split. Anything above it
//    means the formula is wrong, not the fund.
{
  const over = FUNDS.filter(isComputable).filter((f) => computeCarry(f).effectivePct > 0.200001);
  check("7  no fund exceeds the 20% ceiling", over.length === 0, over.length ? over.map((f) => f.name).join(", ") : "27 computable funds checked");
}

section("Structural invariants (not in the original answer key)");

// A ragged CSV silently misaligns every column after the short row, which is
// invisible until someone opens it in a spreadsheet and reads the wrong number.
{
  const rows = toCSV().split("\n");
  const widths = new Set(rows.map((r) => parseCsvLine(r).length));
  const ok = widths.size === 1 && [...widths][0] === CSV_HEADER.length;
  check("CSV row width matches header", ok, `${rows.length} rows, widths ${[...widths].join("/")}, header ${CSV_HEADER.length}`);
}

// The UI withholds the headline number for flagged funds. The export has to
// agree, or the CSV becomes the confident wrong number the UI refused to show.
{
  const idx = CSV_HEADER.indexOf("Effective carry %");
  const rows = toCSV().split("\n").slice(1).map(parseCsvLine);
  const flagged = FUNDS.filter(isComputable).filter((f) => getWarnings(f, computeCarry(f)).length > 0);
  const bad = flagged.filter((f) => {
    const row = rows.find((r) => r[0] === f.name);
    return !row || row[idx] !== "n/m";
  });
  check("flagged funds export n/m, not a number", bad.length === 0, bad.length ? bad.map((f) => f.name).join(", ") : `${flagged.length} flagged funds checked`);
}

// clearsHurdle is set by hand, so nothing at runtime catches a typo. Parsing the
// IRR string is exactly what the product deliberately avoids — but here it is a
// guard on the human rather than an input to the output, and it fails loudly in
// a test run instead of silently changing what a user sees.
{
  const wrong = FUNDS.filter((f) => f.clearsHurdle).filter((f) => {
    const irr = String(f.irr ?? "");
    if (/early|not meaningful/i.test(irr)) return true;
    const n = parseFloat(irr);
    return !Number.isFinite(n) || n < 12;
  });
  check("clearsHurdle only on settled IRR >= 12%", wrong.length === 0, wrong.length ? wrong.map((f) => `${f.name} (${f.irr})`).join(", ") : `${FUNDS.filter((f) => f.clearsHurdle).length} flagged funds checked`);
}

// A clearsHurdle flag on a fund the calculator can't compute would never be
// read, so it is almost certainly a mistake in the reference data.
{
  const orphan = FUNDS.filter((f) => f.clearsHurdle && !isComputable(f));
  check("no clearsHurdle on an uncomputable fund", orphan.length === 0, orphan.length ? orphan.map((f) => f.name).join(", ") : "none");
}

section("Refreshed fund data (Branch 2 refresh)");

// A refresh from a later quarter has to move the report date with it. If it
// doesn't, every carry figure comes out slightly too high and nothing says so.
{
  const f = fund("BCP VII");
  const base = computeCarry(f, asOfToDecimal(BASELINE_AS_OF));
  const later = computeCarry(f, asOfToDecimal({ year: 2027, month: 6 }));
  check(
    "report date is honoured — a later as-of accrues more hurdle",
    later.hurdleAmt > base.hurdleAmt && later.years > base.years,
    `${base.years.toFixed(1)}y $${base.hurdleAmt.toFixed(2)}B -> ${later.years.toFixed(1)}y $${later.hurdleAmt.toFixed(2)}B`
  );
}

// The decimal constant and the {year, month} form are two spellings of the same
// date. If they drift, the baseline silently computes against a date that isn't
// the one the UI prints.
{
  check("BASELINE_AS_OF agrees with REPORT_DATE_DEC", asOfToDecimal(BASELINE_AS_OF) === REPORT_DATE_DEC,
    `${asOfToDecimal(BASELINE_AS_OF)} vs ${REPORT_DATE_DEC}`);
}

const goodRow = { name: "BCP VII", period: "2016-2020", start: 2016, end: 2020, committed: 18.9, available: 1.3, moic: 2.1, irr: "12%", status: "Harvesting" };
const payload = (over) => ({ asOf: { year: 2026, month: 9 }, sourceUrl: "https://www.blackstone.com/x.pdf", sourceLabel: "2Q26 supplemental", sourcePath: "direct", complete: true, notes: "", funds: [goodRow], ...over });

// The waterfall does not throw on a negative paid-in — it just returns numbers
// that look ordinary and are meaningless. This has to be caught at the door.
{
  const r = normalizeRefreshedFunds(payload({ funds: [{ ...goodRow, committed: 1.0, available: 5.0 }] }));
  check("rejects available > committed (negative paid-in)", !r.ok && r.rejected.length === 1,
    r.rejected[0]?.errors?.join("; ") || "not rejected");
}

// Numbers arriving as strings mean the extraction was improvising. Coercing
// them is how "2.4x" and "~2.4" get in later.
{
  const r = normalizeRefreshedFunds(payload({ funds: [{ ...goodRow, moic: "2.1" }] }));
  check("rejects a stringified number rather than coercing it", !r.ok && r.rejected.length === 1,
    r.rejected[0]?.errors?.join("; ") || "not rejected");
}

// The one field the project deliberately keeps in human hands. A model must not
// be able to set it, even by naming it outright.
{
  const r = normalizeRefreshedFunds(payload({ funds: [{ ...goodRow, name: "Brand New Fund", irr: "40%", clearsHurdle: true }] }));
  check("never accepts a model-supplied clearsHurdle", r.ok && r.funds[0].clearsHurdle === undefined,
    `clearsHurdle=${String(r.funds[0]?.clearsHurdle)}`);
}

// Carried across only when the human judgment still describes the number it was
// made about: same fund, same disclosed IRR.
{
  const r = normalizeRefreshedFunds(payload({ funds: [goodRow] }));
  check("carries clearsHurdle across when name and IRR both match", r.ok && r.funds[0].clearsHurdle === true,
    `clearsHurdle=${String(r.funds[0]?.clearsHurdle)}`);
}
{
  const r = normalizeRefreshedFunds(payload({ funds: [{ ...goodRow, irr: "9%" }] }));
  check("drops clearsHurdle when the disclosed IRR moved", r.ok && r.funds[0].clearsHurdle === undefined,
    `irr 12% -> 9%, clearsHurdle=${String(r.funds[0]?.clearsHurdle)}`);
}

// Fresh numbers compounded to an assumed date are worse than no refresh: the
// screen looks updated and the hurdle is quietly wrong.
{
  const r = normalizeRefreshedFunds(payload({ asOf: null }));
  check("refuses the whole refresh when the as-of date is missing", !r.ok && r.funds.length === 0,
    r.problems[0] || "no problem reported");
}
{
  const r = normalizeRefreshedFunds(payload({ asOf: { year: 2026, month: 13 } }));
  check("refuses an implausible as-of month", !r.ok, r.problems[0] || "accepted");
}

// A refresh that quietly lost rows looks identical to a clean one unless the
// dropped names are reported.
{
  const r = normalizeRefreshedFunds(payload({ funds: [goodRow] }));
  check("reports funds the refresh dropped", r.ok && r.removed.length === FUNDS.length - 1,
    `${r.removed.length} of ${FUNDS.length} baseline funds absent`);
}

// The export has to carry provenance per row, or an unverified figure that has
// come loose from its banner is indistinguishable from a checked one.
{
  const refreshed = normalizeRefreshedFunds(payload({ funds: [goodRow] }));
  const prov = { verified: false, asOf: refreshed.asOf, label: "UNVERIFIED — test" };
  const rows = toCSV(refreshed.funds, prov).split("\n");
  const idx = CSV_HEADER.indexOf("Provenance");
  const body = rows.slice(1).map(parseCsvLine);
  const widths = new Set(rows.map((r) => parseCsvLine(r).length));
  check("refreshed CSV stays rectangular and stamps every row unverified",
    idx !== -1 && widths.size === 1 && [...widths][0] === CSV_HEADER.length && body.every((r) => r[idx] === prov.label),
    `${body.length} rows, widths ${[...widths].join("/")}, header ${CSV_HEADER.length}`);
}

// The baseline export must keep saying it is the hand-checked one.
{
  const idx = CSV_HEADER.indexOf("Provenance");
  const rows = toCSV().split("\n").slice(1).map(parseCsvLine);
  check("baseline CSV is stamped as the verified table",
    rows.every((r) => r[idx] === BASELINE_PROVENANCE.label), BASELINE_PROVENANCE.label);
}

// Same invariant as the verified table, on data the model produced: the CSV
// cannot print a number where the UI shows n/m.
{
  const irrUnchanged = FUNDS.filter(isComputable).filter((f) => f.clearsHurdle).map((f) => ({
    name: f.name, period: f.period, start: f.start, end: f.end,
    committed: f.committed, available: f.available, moic: f.moic, irr: f.irr, status: f.status,
  }));
  const r = normalizeRefreshedFunds(payload({ funds: irrUnchanged }));
  const prov = { verified: false, asOf: r.asOf, label: "UNVERIFIED — test" };
  const idx = CSV_HEADER.indexOf("Effective carry %");
  const rows = toCSV(r.funds, prov).split("\n").slice(1).map(parseCsvLine);
  const reportDate = asOfToDecimal(r.asOf);
  const flagged = r.funds.filter((f) => getWarnings(f, computeCarry(f, reportDate), r.asOf).length > 0);
  const bad = flagged.filter((f) => rows.find((row) => row[0] === f.name)?.[idx] !== "n/m");
  check("flagged refreshed funds still export n/m, not a number", bad.length === 0,
    bad.length ? bad.map((f) => f.name).join(", ") : `${flagged.length} flagged of ${r.funds.length} refreshed`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
