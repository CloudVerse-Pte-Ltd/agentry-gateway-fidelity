/** Case 23: A controlled 429 must retain Retry-After. */
import { defineCase } from "./_factory.js";
export default defineCase(23, "23-rate-limit-retry-after", "Rate-limit Retry-After", "retry-after", "A controlled 429 must retain Retry-After.", { mode: "fixture" });
