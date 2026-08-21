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
