/**
 * A24 fixture — fail.
 *
 * `system` is an array, but none of its entries' `text` fields
 * resolve to PANG_VOICE_SYSTEM_PROMPT. An agent that drifted to
 * this shape is the common regression the gate exists to catch.
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

const AGENT_PROMPT = "extract artwork facts";
const EXTRA = "be concise";

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    system: [
      { type: "text", text: AGENT_PROMPT },
      { type: "text", text: EXTRA },
    ],
    messages: [{ role: "user", content: "hi" }],
  });
}
