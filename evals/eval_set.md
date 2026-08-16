# Eval set for carry calculator — written BEFORE the calc function exists

Each case states what should happen and WHY, in plain finance reasoning,
with no reference to any formula. The formula has to satisfy these, not
the other way around.

1. BCP IV — 2.9x MOIC, 36% net IRR, fully realized, deployed 2002-2005.
   EXPECT: strong carry, close to the 20% cap.
   WHY: a fund that returns nearly 3x at a 36% annualized rate blows
   past any normal ~8% hurdle by a wide margin. GP should be well past
   catch-up and capturing close to full carry on the excess.

2. BXG I — 1.2x MOIC, 2% net IRR, post-investment period.
   EXPECT: zero (or near-zero) carry.
   WHY: 2% IRR doesn't come close to an 8% hurdle. LPs haven't even
   gotten their preferred return yet — GP earns nothing until they do.

3. BCP V — 1.9x MOIC, 8% net IRR, harvesting.
   EXPECT: zero or very low carry, even though 1.9x sounds decent.
   WHY: 8% IRR is *at* the hurdle rate, not above it. IRR and the
   hurdle-on-committed-capital aren't computed identically, but they
   should be in the same ballpark — a fund performing right at the
   hurdle shouldn't be generating meaningful carry above it.

4. Energy Transition IV — 2.0x MOIC, deployed very recently (2024-2026).
   EXPECT: high carry despite very little time elapsed.
   WHY: almost no time has passed, so the compounded hurdle is tiny —
   a 2x return clears a barely-accrued hurdle easily.

5. A hypothetical fund at exactly 1.0x MOIC (no gain at all).
   EXPECT: exactly zero carry, zero profit.
   WHY: no profit exists to take carry from. This is a floor case —
   if this doesn't return zero, something is fundamentally broken.

6. A fund with a very old deployment date (e.g. 1987) that is fully realized.
   EXPECT: carry should NOT collapse to zero just because decades have
   passed since deployment.
   WHY: a fully realized fund isn't still accruing a hurdle today — it
   exited long ago. If years-elapsed is measured "to today" with no
   cap, an old successful fund will look like a failure, which is
   backwards. (This is the exact bug from the last build.)

7. Effective carry % should NEVER exceed 20% for any fund, under any inputs.
   WHY: 20% is a hard structural ceiling in a standard carry split. If
   any fund's computed effective % goes above that, the formula itself
   is wrong, not the fund.

---

## Results — appended 2026-08-16, after implementation

The seven cases above are unchanged from when they were written. Everything
below this line was added afterward. Keeping the predictions and the outcomes
separate is deliberate: an answer key edited to match its own implementation
stops being evidence of anything.

| # | Case | Outcome |
|---|------|---------|
| 1 | BCP IV — strong carry near the cap | PASS — 20.0% |
| 2 | BXG I — zero | PASS — 0% |
| 3 | BCP V — zero or very low | PASS — 0% |
| 4 | Energy Transition IV — high despite little time | PASS — 20.0% |
| 5 | 1.0x MOIC — exactly zero | PASS — $0 profit, $0 carry |
| 6 | Old realized fund — should not collapse to zero | Satisfied by disclosure, not by a corrected number — see below |
| 7 | Never above 20% | PASS — no fund exceeds |

Cases 1 and 6 both failed on the first run, and they ended differently.

**Case 1 was a real bug, and it got fixed.** The hurdle compounded from the
deployment date to today with no cap, so BCP IV — 2.9x MOIC, 36% net IRR —
computed 0% carry off a 23-year compound. Capping elapsed years at 12 fixed it.

**Case 6 could not be fixed, and got disclosed instead.** BCP I-III still
computes 0.00 carry. Read strictly, the case still fails — the arithmetic does
collapse to zero. It can't be corrected, because the model would need to know
when capital was actually called and returned, and the public reference table
doesn't record that. What changed is that the tool no longer *presents* the zero
as an answer: the fund's disclosed 19% net IRR contradicts it, so the calculator
says so on screen and shows `n/m` where the number would otherwise sit.

Four other funds turned out to have the same defect and are flagged the same
way: Strategic Partners VII (15% IRR), Strategic Partners VI (13%), BCP VI
(12%), and Energy I (12%). The original case named only BCP I-III.

**A failure mode none of the seven cases anticipated.** Funds still inside their
investment period have a deployment midpoint in the *future*, so elapsed years
floored at 0.1, essentially no hurdle accrued, and they reported a full 20%
carry on unrealized marks — BCP IX, BXG II, Strategic Partners Infrastructure
IV. Same flag applied.

That last one is the useful lesson from this round. The eval set was written to
catch old funds being *understated*, and it did. It did not catch the mirror
image — new funds being *overstated* by the same lump-sum assumption — because
nobody thought to write that case. Writing tests in advance stops the
implementation from grading itself; it does not tell you what you forgot to ask.
