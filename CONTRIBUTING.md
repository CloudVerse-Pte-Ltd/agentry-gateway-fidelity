# Contributing

Contributions that make gateway behavior more observable are welcome.

## Add or change a case

1. Keep one file per numbered case in `cases/`. Multiple probes may live in one case.
2. State the externally observable behavior. Do not depend on private gateway internals.
3. Send the identical semantic request to the direct-provider baseline and the gateway.
4. Make `UNSUPPORTED` depend on the baseline. Never award it from a gateway response alone.
5. Put controlled failure injection in `fixture` mode. Never label fixture evidence as live.
6. Do not retain response content beyond the minimum observation needed for the verdict.
7. Add deterministic mock coverage and run `npm test`, `npm run check`, and `npm run build`.

Case 26 is permanently advisory: self-identification and capability probes cannot prove model identity.

## Repository fence

This is a black-box, standalone project. Do not contribute product source, private schemas, internal route names, governance or ledger concepts, environment-variable names from another product, credentials, customer data, or implementation details about any gateway. Public attribution and dated first-party results are allowed.

## Reports

Do not commit generated result files. Published result artifacts are governed separately from suite source and must include every executed row, including failures and degraded results.

By contributing, you agree that your contribution is licensed under Apache-2.0.
