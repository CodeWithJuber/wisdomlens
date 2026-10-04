# Optional JEV integration

The adapter adds typed model judgments to the six-stage framework. It runs only
when called. Installation and the existing prompt hooks make no JEV requests.
Use Node.js 20 or newer; no npm packages are required.

## Inspect and run

From the repository root, inspect the synthetic example without credentials:

```bash
node skills/decision-engine/scripts/jev-decide.mjs \
  --input skills/decision-engine/assets/jev-example.json --dry-run
```

Create your own input from the example. Supply selected evidence rather than an
entire chat or repository; remove secrets and use only data authorized for JEV.
Replace every example check with results from actual verification. The example
describes a simulation and must not be used as evidence for a real migration.

Set `TYPESAFE_API_KEY` securely in the process environment, then run:

```bash
node skills/decision-engine/scripts/jev-decide.mjs --input decision.json
```

Use `--input -` for JSON from stdin. Exit codes: `0` for a recommendation (or dry
run), `2` for review/blocked, and `1` for input, configuration, or API failure.
The CLI never executes the recommended option.

## Application API

```js
import {
  assessDecision, createJevAdapter,
} from "./skills/decision-engine/scripts/jev-adapter.mjs";

const adapter = createJevAdapter(); // reads TYPESAFE_API_KEY
const result = await assessDecision(decisionInput, adapter);
if (result.status === "recommend") {
  showRecommendation(result.selectedOption);
} else {
  showReview(result);
}
```

For lower-level integration, use `adapter.evaluate({ state, questions })` with
Choice, Score, or Noul questions. An alternative adapter can implement that same
method and return the validated JEV-shaped answer contract. This is not an
OpenAI chat-completions endpoint or a generative-model wrapper.

## Input and code policy

`state` holds the evidence/context. `standards.fairness` and
`standards.commitments` define the criteria. `options` contains 3–20 entries,
each with a unique `id`, a `description`, an explicit `reversible` boolean, and
`checks`. Keep option generation and independent verification outside JEV.

The default policy is illustrative and has not been calibrated on your tasks:

| Field | Default | Meaning |
| --- | --- | --- |
| `minConfidence` | `0.8` | Minimum Choice/Score confidence |
| `minGateProbability` | `0.95` | Required Noul probability for each standard |
| `minMargin` | `0.05` | Minimum utility gap between leading eligible options |
| `maxRiskScore` | `1` | Block a confident risk score above this 0–2 cap |
| `maxCostScore` | `1` | Block a confident cost score above this 0–2 cap |
| `allowIrreversible` | `false` | Prefer probes; block irreversible options |
| `requiredChecks` | `["evidence_verified"]` | Every named check must equal boolean `true` |
| `weights` | benefit `0.4`, cost `0.2`, risk `0.4` | Nonnegative weights that sum to one |

The three Score rubrics use levels 0–2. Code computes a comparison heuristic:
`utility = (benefit_weight * benefit - cost_weight * cost - risk_weight * risk) / 2`.
This is neither an expected monetary value nor a measured probability of success.
Risk/cost caps, fairness, commitments, and deterministic checks are separate gates, never terms
that a large benefit can outweigh. Reversibility and check flags are assertions
by the trusted caller: the adapter does not verify them itself.

Any uncertain unblocked option, an uncertain problem class, or close leading
eligible options sends the decision to review. No passing option means review
or blocked. Report these outcomes honestly; do not silently switch to an LLM and
present its output as a JEV result.

## Transport and evidence limits

Requests use the fixed official `POST https://api.typesafe.ai/v1/systemone`
endpoint and bearer authentication. Redirects are rejected. The default model is
pinned to `jev-1.13.0`; use `JEV_MODEL` or the `model` constructor option to change
it. Returned results retain the actual model ID. Re-evaluate thresholds when
changing models.

Timeouts default to 10 seconds per attempt. Up to two retries cover 429 and 5xx
responses, including 529. Backoff honors Retry-After; waits over 10 seconds return
`retry_later` rather than retrying early. Authentication and validation errors
are not retried. Transport failures, incomplete answers, incompatible types,
invalid distributions, and inconsistent confidence fail without a recommendation.
Provider error bodies and arbitrary exception messages are not logged. A dry run
prints the supplied state locally, so keep that output private where necessary.

Typed output does not prove the judgment is true. Confidence summarizes a
distribution, and a Noul probability is not a severity score. Test accuracy and
thresholds on labeled examples from your domain before relying on this policy.
Local tests use simulated HTTP responses; they do not measure JEV accuracy.

Official references, checked 2026-10-04:
[API](https://docs.typesafe.ai/api),
[primitives](https://docs.typesafe.ai/primitives),
[confidence](https://docs.typesafe.ai/confidence),
[models](https://docs.typesafe.ai/models).
