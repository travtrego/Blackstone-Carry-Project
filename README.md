# Blackstone Carried Interest — Multi-Agent Review Pipeline

A learning project exploring multi-agent LLM systems through a real accounting
use case: reviewing how Blackstone discloses its carried interest terms in
public SEC filings, plus a separate deterministic calculator estimating
per-fund carry economics from public performance data.

**This was built to learn multi-agent architecture and testing discipline —
not as a production tool.** See "What this is / isn't" below before using
any of it for real analysis.

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

The Retriever is the only stage that calls a live tool (`web_search`) and
gets a longer timeout (90s vs. 45s) and retry-with-backoff for that reason.
It asks for the current `web_search_20260209` tool variant and falls back to
the older `web_search_20250305` once per session if the environment rejects
the type — see "the reported bug that wasn't" below for why that is settled at
runtime rather than pinned.

### Branch 2 — Carry-for-Dummies Calculator

Deliberately **not** an LLM doing math. A real, testable JS function
(`computeCarry`) does the actual waterfall calculation — paid-in capital,
compounded hurdle, GP catch-up, 80/20 split. An LLM call only narrates the
*already-computed* numbers in plain language afterward, explicitly
instructed not to recompute anything.

This split exists on purpose: LLM arithmetic can be subtly wrong in ways
that are invisible from the output alone, while a bug in real code is
traceable and fixable. See "Bug #1" below for what that distinction caught.

#### Refresh Fund Data

The reference table is transcribed by hand from Blackstone's quarterly
supplemental. "Refresh Fund Data" re-fetches it with a single-agent extraction
call, pinned to start at the 2Q26 supplemental PDF and permitted to fall back
to a blackstone.com search only if that URL is gone. Domains are enforced on
the tool itself, not just requested in the prompt.

The result is **never** presented as equivalent to the hand-checked table. It
loads as a separate dataset alongside `FUNDS` — which is never mutated, so
reverting is one click — and carries an undismissable banner, a per-fund
`UNVERIFIED` chip, a distinct CSV filename, and a provenance column stamped on
every exported row. Per row rather than as a header line, because a header is
lost the moment anyone sorts the sheet.

Three decisions in the validation layer are worth stating, because all three
chose strictness over a working demo:

- **`clearsHurdle` is never read from the model.** It is the hand-set judgment
  that Bug #2's cross-check depends on, and letting an extraction agent write
  it would quietly undo that fix. It is carried across from the verified table
  only when the fund name *and* the disclosed IRR string both still match. Where
  the IRR moved, the flag is dropped and the banner says the cross-check is
  inactive for that fund — an inactive guard nobody knows about is worse than
  no guard.
- **Rows are rejected, not coerced.** A MOIC arriving as `"2.1"` instead of
  `2.1` is not a formatting quirk to paper over; it is evidence the extraction
  was improvising, and coercing it is how `"2.4x"` and `"~2.4"` get in later.
  Rejected rows are listed by name with reasons rather than silently dropped.
  Funds that vanished between the two tables are listed too — an extraction
  that missed eight rows looks exactly like a clean one from the headline
  figures alone.
- **A missing as-of date rejects the whole refresh.** The hurdle compounds to a
  report date, so fresh numbers dated to an assumed quarter would render a
  screen that looks updated and is quietly wrong in every row. `computeCarry`
  now takes the report date as a parameter for the same reason.

The extraction is one agent, not six. Branch 1's chain-of-custody design exists
to test information loss across handoffs; there are no handoffs here, and
adding stages would only add places for a number to change.

---

## What this is / isn't

**Is:** a working demonstration of building and testing a multi-agent
system, using real public data (Blackstone SEC filings + a Blackstone fund
performance reference table).

**Isn't:** a standalone deployable app. The `carry-review.jsx` file makes
`fetch()` calls to `https://api.anthropic.com/v1/messages` with **no API
key anywhere in the code** — that only works inside Claude's artifact
sandbox, which proxies and authenticates the request invisibly. Clone this
and run it as a normal web app and every button will silently fail.

To actually deploy this, you would need, at minimum:
- A real backend holding the API key server-side (never expose it to the
  browser — anyone could read it from dev tools)
- Real hosting for that backend + frontend
- If used on real client/engagement data: firm AI-governance and InfoSec
  sign-off before it touches anything non-public

**Isn't:** validated against Blackstone's actual current LPA terms. The
calculator's 8% hurdle / 100% catch-up / 20% carry are stated, labeled
assumptions — the pipeline's own Retriever found real disclosed ranges
(5-10% hurdle depending on filing year and vehicle type) that don't match
that flat assumption. This is intentional: Branch 2 is a teaching tool for
how carry math works, not a real economics estimate for any specific fund.

---

## Bugs found through testing (not through a single successful run)

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

### The reported bug that wasn't — the `web_search` tool identifier

Reported as: `web_search_20260209` is an invalid tool identifier and should be
`web_search_20250305`, which is why Branch 1 fails.

It isn't invalid. `web_search_20260209` is the current variant — it adds dynamic
filtering, where results are filtered before they reach the context window — and
it is the correct one for `claude-sonnet-5`, the model this file calls.
`web_search_20250305` is the older basic variant, kept for models before Sonnet
4.6. The change to `_20260209` was deliberate and gated on the Sonnet 5 upgrade.

But the report was not baseless, and the commit that made the change says why:
*"Not verifiable here: the pipeline needs the artifact sandbox to authenticate."*
That upgrade was never run live. The sandbox proxies these calls and is free to
accept a narrower set of tool types than the API documents, so a real failure
there is entirely possible — it just wouldn't mean the identifier was invalid.

Both candidate fixes were wrong in the same way: they answer an empirical
question by guessing. Pinning the modern type fails closed in the only
environment the app runs in; pinning the basic type gives up dynamic filtering
everywhere to satisfy a restriction that may not apply. And nothing local can
settle it, because the sandbox is what authenticates the call.

So it is settled at runtime instead. The code asks for the modern pair, and on
any 400 it retries once with the basic pair.

Matching on the error *message* was the obvious approach and is the wrong one:
that text comes from a proxy whose output nobody here has ever seen, so any
pattern is a guess, and guessing too narrowly is the expensive direction — the
fallback never fires and Branch 1 stays broken in exactly the way that prompted
it. What makes the broad trigger safe is that the downgrade is not believed until
it is *earned*: it sticks only if the basic pair succeeds where the modern pair
failed, which is the only available evidence that the tool type was the
difference. A 400 from anything else — malformed request, billing — fails on both
pairs, the variant is put back, and the error says the tool type is not the
cause. So an unrelated failure cannot leave a session quietly downgraded.

The lesson is the one this project keeps relearning. The instinct on a bug report
naming a specific one-line fix is to apply the one-line fix; the report was
precise, confident, and wrong about the cause while being plausibly right about
the symptom. Checking the claim cost one lookup. Applying it would have silently
downgraded a working stage and left the real failure — whatever it is — intact.

### Pipeline-level findings (Branch 1, across 3 full runs)

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

- `carry-review.jsx` — the full artifact (both branches, tabbed UI)
- `evals/eval_set.md` — the carry-calculator answer key, written *before*
  the calculator was implemented, with the results appended afterward
- `evals/run-evals.mjs` — the answer key as an executable check
- `evals/run-api-evals.mjs` — behavioural checks for the API layer against a
  stubbed fetch: request shaping, retry and truncation policy, and the search
  tool version fallback
- `evals/branch1_eval_criteria.md` — pass/fail behavioral criteria for
  each of the 6 pipeline agents, written before re-testing any of them
- `LICENSE` — MIT

### Running the evals

```
node evals/run-evals.mjs
node evals/run-api-evals.mjs
```

No dependencies, no build step, no `package.json` — the project doesn't have a
toolchain and this doesn't add one. Exits non-zero on failure, so it works as a
pre-commit hook or a CI step.

The first covers the seven cases from `eval_set.md`, four structural invariants
that came out of later work — the CSV can't go ragged, a flagged fund can't
export a number where the UI shows `n/m`, and the hand-set `clearsHurdle` flag
can't drift onto a fund whose IRR doesn't support it — and thirteen more for the
refresh path: the report date has to move the maths, a model-supplied
`clearsHurdle` has to be ignored, a negative paid-in has to be rejected at the
door, and refreshed rows have to obey every invariant the verified ones do.

The second stubs `fetch` and checks the API layer, which the first cannot reach.
Most of it exists for one branch: the tool version fallback only fires when the
environment rejects a type, and the only environment that authenticates these
calls is the artifact sandbox. A downgrade that silently doesn't happen leaves
Branch 1 dead; one that fires when it shouldn't quietly gives up dynamic
filtering. Neither is visible from the output. It also pins the things
deliberately *not* changed — the 4000-token ceiling, disabled thinking, the
retry policy — so a later edit to the shared request builder can't alter Branch
1 while aiming at Branch 2.

The runner slices the pure-maths region out of `carry-review.jsx` at runtime
rather than importing it. That's deliberate: the artifact has to stay a single
self-contained file to run in the sandbox, so it can't be imported by node (it
opens with a React import and contains JSX). Copying the maths into the test
instead would create a second copy of the truth that drifts the first time
someone edits one and not the other. If the file is reorganised so the slice
markers move, the runner fails immediately with a message saying so, rather than
silently testing nothing.

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
