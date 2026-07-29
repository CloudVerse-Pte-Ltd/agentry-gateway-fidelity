# Gateway fidelity report

Generated: 2026-07-29T00:00:00.000Z
Gateway: mock://gateway
Anthropic direct baseline: mock://anthropic-direct
OpenAI direct baseline: mock://openai-direct

> UNSUPPORTED requires an explicit direct-provider refusal or lack-of-capability response recorded in the cell. INDETERMINATE means the case could not be evaluated and is never silently excluded.

## Live cases

| Case | Anthropic Messages | OpenAI Chat Completions | OpenAI Responses |
|---|---|---|---|
| 1. Tool choice auto | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 2. Tool choice required | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 3. Named tool choice | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 4. Tool schema round-trip | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 5. Multi-turn tool loop | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 6. Parallel tool calls | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 7. Tool-result error shape | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 8. Extended thinking | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 9. Thinking budget | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 10. Prompt caching | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 11. Maximum tokens | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 12. Stop sequences | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 13. Temperature zero determinism | PASS — Gateway repeats matched under the requested determinism control. | PASS — Gateway repeats matched under the requested determinism control. | PASS — Gateway repeats matched under the requested determinism control. |
| 14. Seed determinism | INDETERMINATE — The case could not be evaluated: The Anthropic Messages surface has no seed parameter; excluded without sending a request. No direct-provider response was recorded. | PASS — Gateway repeats matched under the requested determinism control. | PASS — Gateway repeats matched under the requested determinism control. |
| 15. System message placement | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 16. Structured output | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 17. Incremental stream deltas | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 18. Finish reason fidelity | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 19. Terminal usage | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 21. Streamed tool calls | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 24. Unknown parameter handling | PASS — Gateway preserved the controlled failure behavior and its observable metadata. | PASS — Gateway preserved the controlled failure behavior and its observable metadata. | PASS — Gateway preserved the controlled failure behavior and its observable metadata. |
| 26. Model substitution advisory | PASS — No baseline/gateway identity divergence was observed. | PASS — No baseline/gateway identity divergence was observed. | PASS — No baseline/gateway identity divergence was observed. |
| 27. Usage pass-through | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 28. Provider and model identity | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. | PASS — Observable response matched the requested behavior. |
| 29. Codex dynamic tool namespace | INDETERMINATE — The case could not be evaluated: Codex sends this container only on the OpenAI Responses wire protocol. No direct-provider response was recorded. | INDETERMINATE — The case could not be evaluated: Chat Completions has no namespace container shape. No direct-provider response was recorded. | PASS — Observable response matched the requested behavior. |
| 30. Usage metadata must not displace content | PASS — Content and usage metadata both survived in the same response. | PASS — Content and usage metadata both survived in the same response. | PASS — Content and usage metadata both survived in the same response. |

Requests: 178; maximum tokens per request: 64.
