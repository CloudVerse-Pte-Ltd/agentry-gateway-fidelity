# Planted-defect validation

The test harness runs each defect in isolation, compares every probe and surface with a good-mock reference, and then runs named defects together. Any status change outside the expected cases fails the test.

| Case | Isolated planted defect | Expected verdict |
| ---: | --- | --- |
| 01 | Force a tool call after an `auto` request whose baseline answers directly | SILENTLY REWRITTEN |
| 02 | Rewrite required tool choice to `auto` and return text | SILENTLY REWRITTEN |
| 03 | Call a different tool than the named tool | SILENTLY REWRITTEN |
| 04 | Remove the required nested object from tool input | SILENTLY REWRITTEN |
| 05 | Drop the final response after a successful tool result | SILENTLY REWRITTEN |
| 06 | Collapse two parallel calls into one | SILENTLY REWRITTEN |
| 07 | Drop the final response after an error tool result | SILENTLY REWRITTEN |
| 08 | Remove thinking/reasoning blocks | SILENTLY REWRITTEN |
| 09 | Remove observable reasoning-token budget metadata | DEGRADED |
| 10 | Remove cache creation/read counters | DEGRADED |
| 11 | Ignore the output-token limit and report normal completion | SILENTLY REWRITTEN |
| 12 | Emit content after the requested stop sequence | SILENTLY REWRITTEN |
| 13 | Return different response identities across deterministic repeats | SILENTLY REWRITTEN |
| 14 | Return different response identities across seeded repeats | SILENTLY REWRITTEN |
| 15 | Treat system/instructions content as ordinary input | SILENTLY REWRITTEN |
| 16 | Return malformed JSON under structured-output mode | SILENTLY REWRITTEN |
| 17 | Buffer all incremental events into one network chunk | SILENTLY REWRITTEN |
| 18 | Replace a normal terminal reason with a length/incomplete reason | SILENTLY REWRITTEN |
| 19 | Remove usage from the terminal stream event | DEGRADED |
| 20 | Replace a typed in-band stream error with an untyped truncation | SILENTLY REWRITTEN |
| 21 | Remove streamed tool-argument fragments | SILENTLY REWRITTEN |
| 22 | Replace a policy refusal with a generic provider error | DEGRADED |
| 23 | Remove `Retry-After` from a controlled 429 | DEGRADED |
| 24 | Accept and silently discard an unknown parameter | SILENTLY REWRITTEN |
| 25 | Return success for a deliberately nonexistent model | SILENTLY REWRITTEN |
| 26 | Return a different observable model identifier | INDICATIVE — possible substitution |
| 27 | Remove non-streaming usage data | DEGRADED |
| 28 | Remove serving model/provider identity | DEGRADED |
| 29 | Forward a Codex `namespace` object into an incompatible provider tool union | REFUSED |
| 30 | Return usage metadata but remove otherwise valid response content | SILENTLY REWRITTEN |

The executable contract is in `test/suite.test.ts`. A case is validated only when its isolated mutant changes to the exact expected result. Case 29 additionally asserts the fixed path is `PASS` while its `namespace-forwarded` mutant is `REFUSED`. Case 30 asserts that usage-only success is an empty-delivery fidelity failure.
