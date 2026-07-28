/** Case 29: Codex dynamic tool namespaces must expand without rejection or loss. */
import { defineCase } from "./_factory.js";

export default defineCase(
  29,
  "29-codex-tool-namespace",
  "Codex dynamic tool namespace",
  "tool-namespace",
  "A sanitized real Codex Responses capture must preserve namespace member names and schemas through a translated gateway.",
  {
    mode: "live",
    surfaces: ["openai-responses"],
    exclusions: {
      "anthropic-messages": "Codex sends this container only on the OpenAI Responses wire protocol.",
      "openai-chat": "Chat Completions has no namespace container shape.",
    },
  },
);
