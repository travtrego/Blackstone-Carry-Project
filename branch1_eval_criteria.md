# Eval criteria for Branch 1 agents — written BEFORE running the pipeline

Unlike Step 1's calculator, there's no single correct output here. So each
agent gets: what a PASS looks like, and specific FAIL patterns to watch
for — concrete enough to check against, not just "does this seem fine."

---

## 1. Retriever
PASS: returns actual disclosure language (something resembling a specific
  hurdle %, a catch-up mechanism, a GP/LP split) sourced ONLY from
  sec.gov or blackstone.com, with a real URL attached.
PASS (alternate, also valid): explicitly states it could not find
  primary-source text at those two domains, and returns nothing else.
  This is a correct outcome, not a failure — a tool that admits it found
  nothing is more trustworthy than one that fabricates a source.
FAIL: cites a non-primary source (a blog, Investopedia, a news aggregator)
  while presenting it as if it were the filing itself.
FAIL: returns generic PE-industry boilerplate ("typically 20% carry over
  an 8% hurdle") disguised as something specific to Blackstone.
FAIL: no source URL at all, but text is presented with confidence as if
  sourced.

## 2. Mechanics Explainer
PASS: explains hurdle, catch-up, GP/LP split, and crystallization
  triggers using language traceable back to the Retriever's raw text.
PASS: explicitly says "not specified in the source" for any term the
  raw text doesn't actually cover.
FAIL: fills a gap with a plausible-sounding industry-standard number
  without flagging that it's not from the source. This is the single
  most dangerous failure mode in the whole chain — it looks identical
  to a properly sourced explanation.
FAIL: explanation doesn't obviously map back to anything in the raw text
  (a sign it drifted into general knowledge instead of using the source).

## 3. Neutral Summarizer
PASS: 3-5 sentences, meaningfully shorter than the Mechanics output.
PASS: preserves the load-bearing facts (the actual hurdle %, the actual
  split), not just the tone of the original.
FAIL: introduces any fact, number, or claim that wasn't in the Mechanics
  Explainer's output — since it never saw the raw filing, anything new
  here is invented, not summarized.
FAIL: compresses so aggressively that a real reviewer downstream
  couldn't form an opinion from it (e.g. "Blackstone has standard carry
  terms" with no numbers at all).

## 4. Disclosure Skeptic
PASS: raises something specific and checkable — an ambiguous trigger
  date, an undefined term, fund-level vs. deal-by-deal ambiguity.
PASS: the critique is SPECIFIC to this summary — if you swapped in a
  generic PE firm's summary, would the same critique still apply
  word-for-word? If yes, that's a bad sign (see FAIL below).
FAIL: generic hedging that would apply to almost any financial
  disclosure ("could be clearer," "more detail would help") without
  naming what's actually missing.
FAIL: critiques something that was already stated plainly in the
  summary — i.e., it's not reading carefully, just performing suspicion.

## 5. Synthesis memo
PASS: cleanly separates "Mechanics" from "Open Questions," and every
  open question traces back to something the Skeptic actually raised —
  it isn't inventing new concerns during synthesis.
FAIL: softens or drops a Skeptic concern that was substantive.
FAIL: adds new mechanics claims not present in the summary it was given.

## 6. Judge
PASS: scores move with actual chain quality — if the Skeptic was vague,
  skepticValueAdd should be low, not a reflexive 7-8.
PASS: cites specific text from the raw source to justify a completeness
  or accuracy score, not just a number with no support.
FAIL: high scores across the board regardless of input quality (a sign
  the Judge is rubber-stamping rather than actually comparing against
  the raw source).
FAIL: scores accuracy/completeness against the Mechanics Explainer's
  output or the Skeptic's output instead of the ORIGINAL raw source —
  this would mean it's only checking that later stages agree with
  earlier ones, not that the chain as a whole stayed true to the filing.

---

## How this gets used
Run the pipeline once for real. Read each stage's actual output against
its criteria above, one at a time, and mark pass/fail with a reason —
same discipline as the Step 2 test runner, just done by eye since there's
no numeric assertion to automate here (a real production version of this
would use a second model call as a grader against these same criteria,
but reading it yourself first is the right place to start).
