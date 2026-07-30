# Gateway Fidelity

Gateway Fidelity is a black-box test suite that shows whether an AI gateway preserves provider behavior or silently changes it.

Gateways translate requests, and a successful HTTP response does not prove that tools, streaming, usage, caching, or model identity survived that translation. This suite sends the same bounded probes through your gateway and directly to the provider, then reports only differences supported by positive baseline evidence.

> **Cost note:** the default command is a local mock and costs **$0**. The first paid option, `--smoke`, makes **18 requests** capped at **64 output tokens each** and is roughly **$0.01–$0.20** with small models. A full run is opt-in: **178 requests**, the same token cap, and roughly **$0.05–$2**. Actual cost depends on current model pricing.

## Run it

```bash
git clone https://github.com/CloudVerse-Pte-Ltd/agentry-gateway-fidelity.git && cd agentry-gateway-fidelity
npm ci
npm run preflight
npm start
```

That first run takes about **three minutes including installation**, starts controlled local endpoints, and prints a complete report. It needs no keys, sends no network traffic after installation, and makes no claim about a live gateway.

## Five verdicts

- **PASS** — the feature arrived intact and behaved as requested.
- **REFUSED (HONEST)** — the gateway could not preserve it and returned a structured error.
- **DEGRADED** — behavior survived partially, but observable metadata or completeness was lost.
- **SILENTLY REWRITTEN** — the request changed while the response looked successful.
- **INDETERMINATE** — the evidence is insufficient to judge; the report always says why.

**INDETERMINATE is a safety feature, not a broken test.** The suite refuses to turn authentication failures, quota errors, ambiguous successes, transport failures, or missing direct observations into claims about a gateway. A run with many indeterminate cells usually means the baseline, credentials, entitlement, or model choice needs attention. It does not mean those cells passed or failed.

## Your traffic, your keys

No test traffic goes to CloudVerse or to any service operated by this project. The CLI runs locally, uses **your keys** against **your gateway** and the provider's direct API, and never includes keys or authorization headers in reports.

## First paid run: smoke

You need one key for your gateway plus a direct-provider key for each enabled protocol.

### Configuration

| Environment variable | What it is | Where to get it | Example value |
| --- | --- | --- | --- |
| `GATEWAY_FIDELITY_GATEWAY_URL` | The OpenAI-compatible base URL of the gateway under test, e.g. `https://your-gateway.example.com/v1` — do not include `/chat/completions`. | Your gateway's API documentation or deployment configuration. | `https://your-gateway.example.com/v1` |
| `GATEWAY_FIDELITY_KEY` | API key used to authenticate to the gateway under test. | Create or copy a runtime API key from the gateway product's **API Keys** or workload-credentials page. Ask the gateway account administrator if you cannot create one; this is not a direct-provider key. | `gw_live_replace_me` |
| `GATEWAY_FIDELITY_ANTHROPIC_BASELINE_URL` | Direct Anthropic API base URL used as the non-gateway baseline. | Anthropic's API documentation; normally keep the supplied default. | `https://api.anthropic.com` |
| `GATEWAY_FIDELITY_ANTHROPIC_BASELINE_KEY` | Direct Anthropic credential. | Create an API key in the Anthropic Console for an account entitled to the selected model. | `sk-ant-replace-me` |
| `GATEWAY_FIDELITY_ANTHROPIC_MODEL` | Anthropic model identifier tested through both paths. | The models list available to the same Anthropic credential and through your gateway. | `your-anthropic-model-id` |
| `GATEWAY_FIDELITY_OPENAI_BASELINE_URL` | Direct OpenAI API base URL used as the non-gateway baseline. | OpenAI's API documentation; normally keep the supplied default. | `https://api.openai.com` |
| `GATEWAY_FIDELITY_OPENAI_BASELINE_KEY` | Direct OpenAI credential. | Create a project API key from the OpenAI Platform API Keys page for a project entitled to the selected model. | `sk-proj-replace-me` |
| `GATEWAY_FIDELITY_OPENAI_MODEL` | OpenAI model identifier tested through both paths. | The models list available to the same OpenAI project and through your gateway. | `your-openai-model-id` |

The tool deliberately does not load `.env` files implicitly. Copy the template,
replace every placeholder, and export it into the current POSIX shell:

```bash
cp .env.example .env
# Edit .env and replace every *_replace_me and your-*-model-id value.
set -a
. ./.env
set +a
npm run preflight -- --real
npm run real -- \
  --base-url "$GATEWAY_FIDELITY_GATEWAY_URL" \
  --anthropic-baseline-url "$GATEWAY_FIDELITY_ANTHROPIC_BASELINE_URL" \
  --openai-baseline-url "$GATEWAY_FIDELITY_OPENAI_BASELINE_URL" \
  --protocol both \
  --anthropic-model "$GATEWAY_FIDELITY_ANTHROPIC_MODEL" \
  --openai-model "$GATEWAY_FIDELITY_OPENAI_MODEL" \
  --smoke --max-requests 18 --max-tokens 64 --json --markdown
```

Preflight checks Node, dependencies, buildability, URL/key shape, reachability, authentication, and model availability using free `/v1/models` requests. It blocks paid execution and names the corrective action if any check fails. Passing preflight does not spend inference money.

Remove `--smoke` and raise `--max-requests` to `178` only when you intentionally want the full suite. For a single provider, use `--protocol anthropic` or `--protocol openai` and supply only that provider's baseline URL, key, and model.

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

Apache-2.0 licensed.
