/**
 * A24 fixture — pass.
 *
 * `system` passes `PANG_VOICE_SYSTEM_PROMPT` directly. Accepted.
 */

// Minimal type stand-in so the fixture compiles without pulling the
// real Anthropic SDK into test dependencies.
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

import { PANG_VOICE_SYSTEM_PROMPT } from "@/ai/prompts/voice";

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    system: PANG_VOICE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: "hi" }],
  });
}
