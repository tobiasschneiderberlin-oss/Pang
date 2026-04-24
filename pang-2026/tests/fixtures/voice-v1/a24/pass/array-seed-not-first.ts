/**
 * A24 fixture — pass.
 *
 * `system` is an array with the seed in the second position. A24
 * accepts this shape; A6 (prompt caching) is the gate that gets
 * strict about cache-ordering. Separating concerns keeps A24
 * narrow.
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

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    system: [
      { type: "text", text: "extract artwork facts" },
      { type: "text", text: PANG_VOICE_SYSTEM_PROMPT },
    ],
    messages: [{ role: "user", content: "hi" }],
  });
}
