# Responsible use

Gateway Fidelity is designed to make translation defects reproducible, not to create a vendor leaderboard.

- Do not present an `INDETERMINATE` or `INDICATIVE` result as a failure.
- Preserve the direct-baseline evidence, model identifiers, limits, timestamps, and tool version needed to reproduce a finding.
- Remove credentials, tenant identifiers, request identifiers, and private prompt content before sharing artifacts.
- Give the affected vendor a reasonable opportunity to investigate and respond before publishing a finding.
- Do not publish comparative vendor results without comparable entitlements, models, limits, and direct baselines.

The maintainers do not publish comparative results from their own gateway runs. Controlled mock reports and isolated planted-defect validation are safe to share because they make no claim about a live vendor.
