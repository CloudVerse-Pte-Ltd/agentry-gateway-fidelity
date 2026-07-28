/** Case 14: Repeated seeded requests should agree where the provider supports seeds. */
import { defineCase } from "./_factory.js";
export default defineCase(14, "seed", "Seed determinism", "seed", "Repeated seeded requests should agree where the provider supports seeds.", { mode: "live", surfaces: ["openai-chat", "openai-responses"], exclusions: { "anthropic-messages": "The Anthropic Messages surface has no seed parameter; excluded without sending a request." } });
