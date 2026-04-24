/**
 * A24 fixture — fail.
 *
 * `system` field absent from the messages.create call. Accidental
 * omission — the agent passes the voice seed as a user message
 * inside `messages` instead of the system channel, which defeats
 * the prompt cache and the voice discipline at once.
 */

declare const client: {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      messages: unknown[];
    }): Promise<{ content: unknown[] }>;
  };
};

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    messages: [{ role: "user", content: "hi" }],
  });
}
