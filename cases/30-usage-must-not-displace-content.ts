/** Case 30: Usage metadata must coexist with, and never displace, content. */
import { defineCase } from "./_factory.js";

export default defineCase(
  30,
  "30-usage-must-not-displace-content",
  "Usage metadata must not displace content",
  "usage-content-coexistence",
  "A successful response must retain both observable content and usage metadata; usage-only success is an empty-delivery fidelity failure.",
  { mode: "live" },
);
