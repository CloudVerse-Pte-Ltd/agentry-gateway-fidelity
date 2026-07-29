# Case study: detecting a 44.5% cache-token undercount

## Finding

A gateway reported successful cached requests, but its accounting path did not preserve the provider's cache-token fields. On the affected workload, comparing the provider usage envelope with the gateway observation exposed a **44.5% token undercount**.

This was not inferred from cost alone. The direct response positively reported cache creation/read tokens while the corresponding gateway observation omitted them.

## How the suite caught it

Case 10 sends the same prompt-caching probe to the direct provider and through the gateway. Its detector compares the ordinary input/output counters and the provider-specific cache counters. If the request succeeds on both paths but the gateway loses cache usage metadata, the result is `DEGRADED`; an authentication or quota error remains `INDETERMINATE`.

The detector has an isolated planted mutant, `cache-counters-dropped`. The normal mock retains cache counters and passes. The mutant removes only those counters and must produce exactly the expected degradation, proving that the case responds to the intended defect rather than an unrelated response difference.

## Fix

The adapter and accounting extraction path was changed to preserve cache creation/read fields alongside ordinary usage. Regression coverage now asserts both the retained content and the complete usage envelope.

The important design rule is broader than caching: usage metadata must be additive. It must neither disappear during protocol translation nor displace response content.

## Scope

This case study documents the detector, the measured undercount, and the remediation pattern. It intentionally does not publish a gateway verdict table or identify comparative vendor results.
