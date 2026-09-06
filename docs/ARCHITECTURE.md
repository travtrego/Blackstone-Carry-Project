# Architecture

## The practical change

The original version was a single Claude artifact. Its browser code called the
Anthropic Messages API directly and relied on Claude's artifact sandbox to add
authentication. That made the file easy to demonstrate but awkward to maintain
and impossible to run normally.

The converted project has five boundaries:

1. `app/page.tsx` mounts the working interface.
2. `components/carry-review.jsx` is the small tabbed application shell.
3. `components/review-pipeline.jsx` and `components/carry-calculator.jsx` own
   the two independent browser workflows.
4. `lib/carry.js` contains the fund snapshot and deterministic waterfall math;
   both the calculator screen and `npm test` import this same module.
5. `app/api/claude/route.ts` is the server-only AI gateway. It reads
   `ANTHROPIC_API_KEY`, validates the request, fixes the model configuration,
   and forwards the request to Anthropic.

The important security rule is that credentials stay at boundary 5, on the
server. `.env.local` is ignored by Git. The current built client assets were
scanned for both configured credential values with zero matches. This is a
check of this build, not a claim about every historical revision.

## Two different kinds of computation

The application deliberately keeps finance math and language generation
separate:

- `computeCarry()` performs the waterfall with ordinary JavaScript. Its result
  is deterministic: the same fund data always produces the same numbers.
- Claude explains already-computed results and processes disclosure text. Its
  result is probabilistic and can vary between runs.

This is why `npm test` grades the math directly, while
`evals/branch1_eval_criteria.md` defines behavioral review criteria for the AI
pipeline. A numeric invariant and a model-quality judgment are different test
problems and should not be disguised as one another.

## Request flow

```text
Browser UI
   |
   | POST /api/claude (instructions and source text, no credential)
   v
Server route
   |
   | Adds ANTHROPIC_API_KEY and fixed model settings
   v
Anthropic Messages API
   |
   | Returns content blocks and stop reason
   v
Browser UI -> next pipeline stage
```

`lib/review-flow.js` defines the ordered six-stage handoff and validates the
judge's scores. The browser client validates completed responses and preserves
primary-source search citations. Incomplete responses and search-tool errors
inside an HTTP 200 are failures, not usable output.

Both client and server implement abort/deadline handling. Server deadlines are
90 seconds for retrieval and 60 seconds for analysis, with five extra seconds
at the browser boundary. There are no automatic retries. The user can resume
the first unfinished stage without rerunning completed stages. Cancellation
propagated successfully through the local Node server in the live audit, but
cannot guarantee reversal of work or billing already performed upstream.

The server owns model/token limits, the basic-search tool definition, the two
search-use limit, and allowed domains. A process-local single-request guard
prevents overlapping upstream calls, returning 429 to a second caller. It is
not a distributed quota system. The JSON body is bounded while reading it;
malformed requests fail before a paid call. Logs record only request kind,
status and duration, not prompts or credentials.

## Local lifecycle

The dev and production launchers load `.env.local` with Node's env-file option
before Vinext starts; isolated route execution previously missed the saved
settings. `npm start` explicitly starts the Node server bound to loopback, not
the Windows-incompatible worker runtime used by the old start script.

Both branch components remain mounted while switching tabs, preserving results.
Results are still browser-memory only: refreshing, closing, or restarting the
page loses unsaved work. Save All and CSV are explicit file downloads. No
database, background job queue, persistent history or auto-resume after closure
is implemented.

## Known boundaries

- The dated fund table's original source document is missing, so its data is
  unverified. Neither tests nor the AI judge establish its factual accuracy.
- The calculator models paid-in capital as a lump sum at the deployment
  midpoint. Warnings suppress a confident headline when that approximation is
  visibly misleading; they do not repair missing cash-flow timing.
- Committed less available is only a paid-in proxy. MOIC-derived total value
  is not verified distributable cash; gross/net conventions are not established
  by the retained table. Real fund economics need source data and actual terms.
- The judge reviews the memo against AI-assembled retrieved excerpts, not an
  independently loaded full filing. Two bounded searches trade coverage for
  predictable latency. Missing private-LPA terms must remain missing.
- The server binds to loopback and checks local Host / same-origin requests.
  Public deployment still needs real authentication, per-user spending limits,
  durable rate limiting and a deployment/security review. Do not expose this
  local server through a public tunnel.
- Any use with confidential client information requires the relevant firm's AI
  governance and information-security approval.
