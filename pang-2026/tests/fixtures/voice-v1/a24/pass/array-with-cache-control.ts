/**
 * A24 fixture — pass.
 *
 * `system` is an array of typed entries; the first has text =
 * PANG_VOICE_SYSTEM_PROMPT with cache_control ephemeral (the
 * canonical shape the agents use). Accepted.
 */

declare const client: {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: unknown;
      messages: unknown[];
    }): Promise<{ content: unknown[] }>;
  };
};

import { PANG_VOICE_SYSTEM_PROMPT } from "@/ai/agents/_shared";

const AGENT_PROMPT = "extract artwork facts";

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    system: [
      {
        type: "text",
        text: PANG_VOICE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: AGENT_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: "hi" }],
  });
}
