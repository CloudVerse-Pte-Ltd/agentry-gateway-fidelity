# Gateway Fidelity

Gateways modify requests in transit. Some modifications are necessary protocol translation; others are silent losses when a gateway does not understand a field. Callers are rarely told. Gateway Fidelity sends requests whose correct handling is observable in the response and compares every gateway observation with the same request sent directly to the provider.

## Detector validation

Detector validation is separate from gateway results. **All 28 cases are validated against isolated planted defects; the validation matrix is in [`docs/detector-validation.md`](docs/detector-validation.md).** Each case must change to its exact expected result, and named gateway-level defects are also run together to detect interference.

Case 14 makes zero Anthropic requests. Without a direct-provider response proving lack of support, the Anthropic Messages cell is rendered explicitly as `INDETERMINATE`; it is never silently omitted.

## The central result: delta from a direct baseline

Each enabled protocol requires its own direct-provider baseline: `--anthropic-baseline-url` and/or `--openai-baseline-url`. `UNSUPPORTED` is assigned only when a recorded direct-provider response explicitly refuses or lacks the feature. Quota failures, authentication failures, malformed requests, transport errors, ambiguous successful responses, and unexecuted cells are `INDETERMINATE`. A feature that works directly but changes through the gateway is a gateway finding. Without that paired observation, the suite does not claim to know which layer lost the behavior.

**Never use a gateway, proxy, router, or compatibility layer as a baseline.** Comparing one translating gateway with another can produce meaningless PASS results when both lose the same field. The baseline must be the provider's direct API. The CLI rejects a baseline URL identical to `--base-url`, but it cannot prove that some other hostname is truly direct; that remains the operator's responsibility.

```text
direct provider ── same model, request, and limits ── gateway
       │                                             │
       └──────────── compare observations ───────────┘
```

OpenAI Chat Completions and OpenAI Responses are tested and reported as separate surfaces. Anthropic Messages is the third surface.

## Five verdicts

The five evaluated verdicts are:

1. **PASS** — the feature arrived intact and behaved as requested.
2. **REFUSED (HONEST)** — the gateway could not preserve it and returned a structured error.
3. **DEGRADED** — behavior partially survived, but observable metadata or completeness was lost.
4. **SILENTLY REWRITTEN** — the request changed while the response looked successful.
5. **INDETERMINATE** — the case could not be evaluated; the result always includes the reason.

An honest refusal is better than a silent success because the caller can branch, retry elsewhere, or fix the request. A successful response that quietly changes semantics gives the caller false confidence and can corrupt an agent loop without an actionable error.

`UNSUPPORTED` is a baseline-evidence classification, not a sixth verdict. It requires an explicit direct-provider refusal or lack-of-capability response recorded in the result cell; without that positive evidence, the cell is `INDETERMINATE`. Case 26 can emit **INDICATIVE — possible substitution** when an observable identity signal diverges; this is advisory and never treated as proof of model substitution.

## Use

```bash
npx @cloudverse/gateway-fidelity \
  --base-url https://gateway.example.com \
  --anthropic-baseline-url https://api.anthropic.com \
  --openai-baseline-url https://api.openai.com \
  --key "$GATEWAY_KEY" \
  --anthropic-baseline-key "$ANTHROPIC_KEY" \
  --openai-baseline-key "$OPENAI_KEY" \
  --gateway-auth bearer \
  --protocol both \
  --model model-id \
  --max-requests 200 \
  --max-tokens 64 \
  --json \
  --markdown
```

Use `--anthropic-model`, `--openai-chat-model`, and `--openai-responses-model` when the surfaces require different model identifiers. `--openai-model` remains a shared fallback for both OpenAI surfaces, and `--model` is the final fallback for every enabled surface. `--json` and `--markdown` may be used together and write separate files. Keys can instead be provided through `GATEWAY_FIDELITY_KEY`, `GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY`, and `GATEWAY_FIDELITY_OPENAI_BASELINE_KEY`; keys are never included in reports.

Gateway keys default to bearer authentication on every surface. Use `--gateway-auth native` only when the gateway explicitly requires provider-native authentication (`x-api-key` for Anthropic and bearer for OpenAI). Direct baselines always use the provider-native scheme.

The CLI prints request count and maximum tokens per request before sending anything. `--max-requests` aborts before execution if the planned count is too high. This project intentionally does not estimate spend or maintain provider rate cards.

## How to read results

- Read each surface independently; translation may preserve Chat Completions while losing Responses semantics.
- Treat `UNSUPPORTED` as an evidence-backed direct-provider limitation, not a gateway win or loss.
- Treat `INDETERMINATE` as unfinished evaluation, never as an exclusion or pass.
- Treat case 26 as a lead for investigation, not attribution evidence.
- Check the run mode. Live and fixture results are never mixed implicitly.
- A missing row means it was not run. It must not be interpreted as passing.

## Live and fixture cases

The default run contains live black-box cases. `--fixtures` additionally enables controlled cases for mid-stream errors, refusal provenance, rate limits, and model-not-found behavior. Those cases require an endpoint deliberately implementing the documented fixture behavior; they are reported as `fixture` and must never be presented as live proof.

There are exactly 28 numbered case files in [`cases`](cases), with multiple probes permitted inside a case. See [CONTRIBUTING.md](CONTRIBUTING.md) for the extension contract.

## Privacy and redaction

The suite never reports keys or authorization headers. Reports contain observations needed for verdicts, not full prompts or provider responses. JSON and Markdown outputs are created with owner-only permissions where the operating system supports them.

Apache-2.0 licensed. Publication and npm release remain subject to founder review.
