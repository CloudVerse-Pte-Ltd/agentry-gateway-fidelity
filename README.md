# Gateway Fidelity

Gateway Fidelity is a black-box test suite that shows whether an AI gateway preserves provider behavior or silently changes it.

Gateways translate requests, and a successful HTTP response does not prove that tools, streaming, usage, caching, or model identity survived that translation. This suite sends the same bounded probes through your gateway and directly to the provider, then reports only differences supported by positive baseline evidence.

> **Cost warning:** the default live run makes **178 HTTP requests** (89 paired gateway/direct observations), capped at **64 output tokens per request**. With small models it will commonly cost roughly **$0.05–$2 total**, but model and provider pricing can make it higher. The CLI prints the exact request count before sending traffic; check your providers' current prices and lower `--max-requests` or choose cheaper models if needed.

## Run it

```bash
git clone https://github.com/CloudVerse-Pte-Ltd/agentry-gateway-fidelity.git && cd agentry-gateway-fidelity && npm ci && npm run build
export GATEWAY_FIDELITY_KEY=... GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY=... GATEWAY_FIDELITY_OPENAI_BASELINE_KEY=...
node dist/src/cli.js --base-url https://gateway.example.com --anthropic-baseline-url https://api.anthropic.com --openai-baseline-url https://api.openai.com --protocol both --anthropic-model YOUR_ANTHROPIC_MODEL --openai-model YOUR_OPENAI_MODEL --json --markdown
less gateway-fidelity-$(date +%F).md
```

You need one key for your gateway plus a direct-provider key for each enabled protocol. For a single provider, use `--protocol anthropic` or `--protocol openai` and supply only that provider's baseline URL, key, and model.

## Five verdicts

- **PASS** — the feature arrived intact and behaved as requested.
- **REFUSED (HONEST)** — the gateway could not preserve it and returned a structured error.
- **DEGRADED** — behavior survived partially, but observable metadata or completeness was lost.
- **SILENTLY REWRITTEN** — the request changed while the response looked successful.
- **INDETERMINATE** — the evidence is insufficient to judge; the report always says why.

**INDETERMINATE is a safety feature, not a broken test.** The suite refuses to turn authentication failures, quota errors, ambiguous successes, transport failures, or missing direct observations into claims about a gateway. A run with many indeterminate cells usually means the baseline, credentials, entitlement, or model choice needs attention. It does not mean those cells passed or failed.

## Your traffic, your keys

No test traffic goes to CloudVerse or to any service operated by this project. The CLI runs locally, uses **your keys** against **your gateway** and the provider's direct API, never phones home, and never includes keys or authorization headers in reports.

## See output without spending money

[`examples/mock-report.md`](examples/mock-report.md) is generated entirely from the controlled local mock endpoint. It demonstrates report shape and verdict language; it contains no vendor results. To reproduce it:

```bash
npm ci
npm run sample
```

## How the comparison works

Each enabled protocol requires its own direct-provider baseline. `UNSUPPORTED` is a baseline-evidence classification, not a sixth verdict: it is assigned only when a recorded direct response explicitly refuses or lacks the feature. Without that positive evidence, the result is `INDETERMINATE`.

**Never use another gateway, proxy, router, or compatibility layer as the baseline.** Comparing two translating gateways can produce meaningless passes when both lose the same field.

```text
direct provider ── same model, request, and limits ── gateway
       │                                             │
       └──────────── compare observations ───────────┘
```

OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages are separate surfaces. Use `--anthropic-model`, `--openai-chat-model`, and `--openai-responses-model` if they require different identifiers. Gateway authentication defaults to bearer; use `--gateway-auth native` only when your gateway explicitly requires provider-native authentication.

Case 26 may emit **INDICATIVE — possible substitution** when observable identity differs. That is an advisory lead, never proof of substitution.

## Detector validation and captures

All **30 cases** are validated against isolated planted defects; see [`docs/detector-validation.md`](docs/detector-validation.md). Case 30 verifies that content and usage coexist and that a usage-only “success” is an empty-delivery failure.

The sanitized six-provider captures in [`fixtures/provider-captures`](fixtures/provider-captures) preserve content-plus-usage examples from Anthropic, DeepSeek, Mistral, OpenAI, Together, and xAI. Their metadata states the capture boundary and provenance; they contain no keys, tenant IDs, request IDs, or private prompts.

Fixture cases enabled with `--fixtures` require an endpoint deliberately implementing the documented behavior. They are labelled `fixture` and must never be presented as live vendor proof.

## Responsible use

We do not publish comparative vendor results from our own runs. Please give a vendor a reasonable opportunity to investigate and respond before publishing a finding about its product. See [`docs/responsible-use.md`](docs/responsible-use.md).

The cache-token undercount case study is documented at [`docs/case-studies/cache-token-undercount.md`](docs/case-studies/cache-token-undercount.md). It explains the detector and remediation without publishing a vendor verdict table.

Apache-2.0 licensed. Publication and npm release remain subject to founder review.
