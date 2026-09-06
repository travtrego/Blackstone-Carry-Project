# Blackstone Carried Interest — Multi-Agent Review Pipeline

A learning project exploring multi-agent LLM systems through a real accounting
use case: reviewing how Blackstone discloses its carried interest terms in
public SEC filings, plus a separate deterministic calculator estimating
per-fund carry economics from public performance data.

**This was built to learn multi-agent architecture and testing discipline —
not as a production tool.** See "What this is / isn't" below before using
any of it for real analysis.

---

## Run it locally

The project is now a normal web application rather than a Claude-only
artifact.

**Already set up on this computer?** Double-click `START TOOL.cmd` in this
folder, keep its window open, and open <http://localhost:3000>. Your saved
`.env.local` settings load automatically. If the tool is already running, just
open that address. Closing the server window stops the tool; closing a browser
tab does not delete your code or settings, but unsaved results are lost.

For a fresh setup (Node.js 22.13 or newer):

1. Install the app dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add an Anthropic API key:

   ```text
   ANTHROPIC_API_KEY=your-key-here
   ANTHROPIC_WORKSPACE_ID=your-workspace-id-here
   ```

   `ANTHROPIC_WORKSPACE_ID` is required for identity-linked personal keys. Copy
   it from **Claude Platform > Settings > Workspaces**. Legacy workspace keys
   can leave it blank.

   Never commit `.env.local`. The browser never receives this key; AI requests
   go through `app/api/claude/route.ts`, which adds the credential on the
   server.

3. Start the app:

   ```powershell
   npm run dev
   ```

4. Open <http://localhost:3000>. Branch 1 runs the six-stage AI review; Branch 2
   calculates immediately and only calls Claude when you click Explain.

The deterministic calculator and CSV export work without an API key. The
six-stage review pipeline and plain-language AI explanation require the key.

Run all automated checks with `npm test`, or tests plus a production build with
`npm run check`. Run `npm run lint` separately. To serve the built app locally,
use `npm run build` followed by `npm start`. Both launchers load `.env.local`.

### Current verified status — September 4, 2026

The full six-stage pipeline completed in the browser in approximately 1 minute
40 seconds, and the complete report exported successfully. Calculator AI,
CSV export, cancellation, and branch switching were also exercised. The local
production build serves the app and completes a Claude API smoke test.

See `docs/AUDIT-2026-09-04.md` for the evidence, fixes, and unresolved limits.
These are observed runs, not a guarantee of future model latency or accuracy.

---

## Why this exists

Most multi-agent demos show a pipeline that works once, on camera. The
actual point of this project was different: build something, write down
what "correct" means *before* judging any output, then find out — by
testing repeatedly — whether it's actually reliable or just looked good
once.

That process surfaced two real bugs a single successful run would never
have caught. Both are documented below with what they were and how they
were found.

---

## Architecture

### Branch 1 — Disclosure Review Pipeline (6 agents)

A chain-of-custody design: each agent hands off to the next with
deliberately restricted context, so the pipeline can be tested for
*information loss*, not just correctness.

1. **Retriever** — `web_search`, restricted to sec.gov / blackstone.com only.
   Required to date every source and prefer the most recent filing.
2. **Mechanics Explainer** — reads the raw retrieved text, explains hurdle /
   catch-up / GP-LP split / crystallization terms. Instructed to explicitly
   flag anything the source doesn't cover, rather than filling gaps with
   plausible-sounding industry defaults.
3. **Neutral Summarizer** — compresses the Mechanics output to 3-5 sentences.
   **Deliberately never sees the raw source** — only the prior agent's
   output — so the pipeline can be tested for what a blind compression step
   loses.
4. **Disclosure Skeptic** — reviews *only* the Summarizer's compressed
   output (not the raw filing, not the full Mechanics explanation). Plays
   a second-reviewer role, hunting for unsubstantiated claims and ambiguity.
5. **Synthesis** — combines the summary and the Skeptic's concerns into a
   final reviewer memo.
6. **Judge** — grades the final memo against the *original raw source*
   (not against any intermediate agent output) on completeness, accuracy,
   and skeptic value-add, each 0-10 with cited justification.

The Retriever is the only stage that calls a live tool (`web_search`). It uses
basic search with at most two tool uses, limited to SEC/Blackstone domains.
The server deadline is 90 seconds for search and 60 seconds per analysis stage;
browser deadlines are five seconds longer and include response-body reading.
There are no automatic paid retries. A failure stops downstream work; Retry
Failed Stage keeps completed results in the current page. Cancel aborts the
request, subject to upstream cancellation behavior. The UI shows elapsed time
and completed-stage timings.

Retrieval requires actual primary-domain citation metadata, not merely a URL
written in prose. Search errors, incomplete output, and malformed judge scores
are rejected. Excerpts remain AI-assembled: this is not a guarantee that the
newest filing or every relevant disclosure was found. Save All exports the
completed stages; save before refreshing or closing the tab.

### Branch 2 — Carry-for-Dummies Calculator

Deliberately **not** an LLM doing math. A real, testable JS function
(`computeCarry`) does the actual waterfall calculation — paid-in capital,
compounded hurdle, GP catch-up, 80/20 split. An LLM call only narrates the
*already-computed* numbers in plain language afterward, explicitly
instructed not to recompute anything.

This split exists on purpose: LLM arithmetic can be subtly wrong in ways
that are invisible from the output alone, while a bug in real code is
traceable and fixable. See "Bug #1" below for what that distinction caught.

---

## What this is / isn't

**Is:** a working local demonstration using live primary-source search and a
dated fund-performance table inherited from the original artifact. The table's
original source document is not retained here and its figures have not been
independently verified.

**Is:** a standalone local web application. The original artifact's direct
browser-to-Anthropic request has been replaced with a server route. That route
holds the API key outside the browser and returns clear configuration errors
instead of letting the buttons silently fail.

**Isn't:** ready for unrestricted public production use. The current server
binds to loopback and the AI route rejects non-local hosts and cross-origin
requests. These are local-use safeguards, not authentication. Public hosting
requires authentication, per-user spending controls, durable rate limiting,
and appropriate governance before processing confidential information.

**Isn't:** validated against Blackstone's actual current LPA terms. The
calculator's 8% hurdle / 100% catch-up / 20% carry are teaching assumptions.
Committed minus available capital is a paid-in proxy, MOIC-derived total value
is not verified distributable cash, and the midpoint/12-year timing model is
not actual cash-flow timing. A hurdle is not a guaranteed return; net IRR alone
does not establish actual contractual carry. Assumptions and provenance warnings
are included on every exported CSV row.

---

## Bugs found through testing (not through a single successful run)

The history below records the original artifact's reasoning and observations,
not independent validation of the input table or actual fund economics. In the
September 2026 audit, warning language was corrected: high reported net IRR is
only a potential model inconsistency, not proof that an actual hurdle was met;
the 12-year cap is a teaching approximation, not verified realization timing.

### Bug #1 — Hurdle compounding to "today" instead of to realization

The calculator initially compounded the 8% hurdle from a fund's deployment
date all the way to the current report date, for every fund — including
funds that were **fully realized years or decades ago**. Result: BCP IV, a
2.9x MOIC / 36% IRR fund (one of the strongest in the dataset), came out to
**0% carry**, because a 23-year uninterrupted compound produced a hurdle
larger than the fund's actual profit.

Fix: capped years-elapsed at 12 (a typical full closed-end fund lifecycle),
so mature/realized funds stop accruing hurdle once they're actually done.

This was only caught by writing `evals/eval_set.md` **before** building the
calculator, then running the implementation against it — a one-off manual
spot check on a different fund had already missed it.

### Bug #2 — Long-duration funds still under-modeled after the fix

Even after the 12-year cap, one eval case still failed: BCP I-III, deployed
1987-2002 (15-year investment period), 19% net IRR, still computed 0%
carry. Root cause: the model treats all paid-in capital as a lump sum at
the fund's midpoint, which doesn't reflect how capital is actually called
and returned gradually over a long fund life — a real structural limitation
given the data available (no capital-call timing in the public reference
table), not a fixable bug.

Resolution: rather than force a fix the data can't support, the calculator
cross-checks its own output against the fund's *disclosed* net IRR. If the
IRR clearly clears the hurdle but the computed carry is ~0%, it surfaces an
explicit warning that the model understates carry for that fund, and the
headline "effective carry" figure reads `n/m` instead of a confident `0.0%`.
The full waterfall stays visible above it, so the calculation trail is still
inspectable — only the takeaway number is withheld.

Two details worth stating, because both were judgment calls:

- The "clearly clears the hurdle" test is a hand-set `clearsHurdle` flag on
  each fund, not a parse of the IRR string at runtime. The IRR values are
  human-written labels (`"24% (early)"`, `"not meaningful"`, `"early
  history"`), and code that digs numbers out of those fails *silently* on the
  next odd format — precisely the class of bug this project exists to catch.
- The threshold is 12%, not 8%. IRR and hurdle-on-paid-in aren't computed the
  same way, so a fund at 8-9% is genuinely too close to call — eval case 3
  expects BCP V at 8% IRR to show ~zero carry, and it correctly does. Funds
  whose IRR the source marks early or not meaningful are excluded too: an
  unrealized early-life IRR is not evidence a hurdle was cleared.

This affects five funds, not just BCP I-III: also Strategic Partners VII
(15%), Strategic Partners VI (13%), BCP VI (12%), and Energy I (12%).

Note what this does and doesn't do. The computed number is still 0.00 — it
cannot be corrected without capital-call timing that isn't public. Eval case
6 asked that carry "not collapse to zero"; strictly read, the arithmetic
still collapses. What changed is that the tool no longer *presents* that zero
as an answer. The case is satisfied by disclosure, not by a better estimate,
and that distinction is the whole point of the fix.

### Original artifact's reported pipeline findings (3 earlier runs)

- Run 1: Retriever mislabeled a 10-Q as a 10-K (source content was real,
  citation type was wrong). Did not recur in runs 2 or 3.
- Run 1: Summarizer blended two distinct vehicle-specific figures into a
  vague range ("10-20% depending on structure") that didn't match either
  source number precisely. Did not recur in runs 2 or 3.
- Both were one-off model variance, not reliable patterns — but both
  prompts were hardened afterward anyway (see system prompts in code) since
  the fix cost was low relative to the risk of silent recurrence.

---

## Files

- `app/page.tsx` — application entry point
- `app/api/claude/route.ts` — server-only Anthropic API boundary
- `components/carry-review.jsx` — small tabbed application shell
- `components/review-pipeline.jsx` — six-stage disclosure-review workflow
- `components/carry-calculator.jsx` — calculator interface and CSV download
- `lib/carry.js` — dated fund data and deterministic waterfall calculations
- `lib/claude-client.js` — browser-to-server AI request handling
- `lib/review-flow.js` — stage prompts, restricted handoffs, resume, judge validation
- `app/api/health/route.ts` — local configuration-readiness check (no key values)
- `START TOOL.cmd` — double-click Windows development launcher
- `docs/AUDIT-2026-09-04.md` — current runtime/security/data-quality audit
- `evals/runtime.test.mjs` — transport, source validation, workflow, and proxy tests
- `lib/theme.js` — shared visual tokens
- `legacy/carry-review.artifact.jsx` — preserved pre-conversion Claude artifact
- `evals/eval_set.md` — the carry-calculator answer key, written *before*
  the calculator was implemented, with the results appended afterward
- `evals/run-evals.mjs` — the answer key as an executable check
- `evals/branch1_eval_criteria.md` — pass/fail behavioral criteria for
  each of the 6 pipeline agents, written before re-testing any of them
- `LICENSE` — MIT

### Running the evals

```
npm test
```

The finance answer key also runs directly with `node evals/run-evals.mjs`
without installed dependencies. `npm test` additionally runs the Node test
suite for cancellation, timeouts, source citations, resume, output schemas,
API validation and value-conservation checks. Tests fail with a non-zero exit.

It covers the seven cases from `eval_set.md` plus four structural invariants
that came out of later work: the CSV can't go ragged, a flagged fund can't
export a number where the UI shows `n/m`, and the hand-set `clearsHurdle` flag
can't drift onto a fund whose IRR doesn't support it.

The runner imports `lib/carry.js`, which is also imported by the calculator
interface. That gives the app and its answer key one source of truth without
copying formulas or extracting source-code slices at runtime.

---

## Lessons that transfer beyond this project

1. Write down what "correct" looks like before you build the thing that's
   supposed to produce it — otherwise the implementation grades itself.

   But know the limit of that. Writing the cases first stops the
   implementation from grading itself; it does not tell you what you forgot
   to ask. The eval set here was written to catch old funds being
   *understated*, and it caught exactly that. It missed the mirror image —
   funds still inside their investment period, where the same lump-sum
   assumption *overstates* carry on unrealized marks — because nobody thought
   to write that case. It only surfaced later, from sweeping all 27 computable
   funds rather than the five the cases happened to name. A written eval set
   narrows what you check. It doesn't widen it.

2. Never let an LLM do arithmetic that a few lines of real code can do
   deterministically and verifiably instead.

3. A single successful run tells you almost nothing. Repeat runs are what
   separate a real bug from ordinary model variance.

4. When a system can't solve a problem with the data it has, the right
   fix is often an honest flag, not a forced number.
