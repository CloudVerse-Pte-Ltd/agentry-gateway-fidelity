import type { Comparison, Observation } from "./types.js";

export function compareObservations(baseline: Observation, gateway: Observation, advisory = false): Comparison {
  if (!baseline.feature) {
    const evidence = baselineEvidence(baseline);
    if (baseline.refused && /unsupported|not_supported|capabilit/i.test([baseline.errorType, baseline.errorCode, baseline.errorParam, baseline.detail].filter(Boolean).join(" "))) {
      return { status: "UNSUPPORTED", detail: `Direct provider explicitly rejected or lacked the feature (${evidence}).` };
    }
    return { status: "INDETERMINATE", detail: `The case could not be evaluated: the direct baseline did not prove the feature (${evidence}).` };
  }
  if (advisory) {
    if (!gateway.success || !gateway.supported) return { status: "INDETERMINATE", detail: `The case could not be evaluated through the gateway (${gateway.detail}).` };
    if (!gateway.signal) return { status: "INDETERMINATE", detail: "The case could not be evaluated: the gateway response did not include a serving-model receipt." };
    if (!baseline.signal) return { status: "INDETERMINATE", detail: "The case could not be evaluated: the direct baseline did not include a serving-model receipt." };
    return gateway.signal !== baseline.signal
      ? { status: "INDICATIVE", detail: `Possible substitution: baseline=${baseline.signal}; gateway=${gateway.signal}. This is advisory, not proof.` }
      : { status: "PASS", detail: "No baseline/gateway identity divergence was observed." };
  }
  if (gateway.refused) return { status: "REFUSED", detail: "Gateway returned a structured refusal instead of silently changing the request." };
  if (!gateway.success || !gateway.supported) return { status: "INDETERMINATE", detail: `The case could not be evaluated through the gateway (${gateway.detail}).` };
  if (gateway.metadata === false) return { status: "DEGRADED", detail: gateway.detail };
  if (!gateway.feature) return { status: "SILENTLY_REWRITTEN", detail: "Baseline demonstrated the feature, but the successful gateway response did not." };
  if (gateway.complete === false) return { status: "DEGRADED", detail: gateway.detail };
  return { status: "PASS", detail: gateway.detail };
}

function baselineEvidence(observation: Observation): string {
  if (observation.httpStatus === undefined) return observation.detail;
  const error = [observation.errorType, observation.errorCode, observation.errorParam].filter(Boolean).join("/");
  return `HTTP ${observation.httpStatus}${error ? ` ${error}` : ""}: ${observation.detail}`;
}
