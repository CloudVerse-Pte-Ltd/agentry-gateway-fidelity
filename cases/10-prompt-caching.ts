/** Case 10: Cache controls and observable usage counters must survive. */
import { defineCase } from "./_factory.js";
export default defineCase(10, "prompt-caching", "Prompt caching", "cache", "Cache controls and observable usage counters must survive across a creation/read cycle.", { mode: "live", probes: 2 });
