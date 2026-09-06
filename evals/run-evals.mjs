#!/usr/bin/env node
//
// Runs evals/eval_set.md against the real implementation.
//
//   node evals/run-evals.mjs
//
// Exits non-zero if anything fails, so it works as a pre-commit or CI check.
// This check still has no runtime dependencies, so the finance answer key can
// run even when the web-app dependencies have not been installed yet.
//
// The calculator is a pure JavaScript module. The browser interface and this
// answer key import the same functions, so there is one source of truth and no
// source-code slicing or duplicated formulas.
import {
  FUNDS,
  CSV_HEADER,
  computeCarry,
  getWarnings,
  isComputable,
  toCSV,
} from "../lib/carry.js";

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
const fund = (name) => {
  const f = FUNDS.find((x) => x.name === name);
  if (!f) throw new Error(`No fund named ${name} — the reference data changed.`);
  return f;
};

console.log("Blackstone carry calculator — eval set");
console.log("source: lib/carry.js");

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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
