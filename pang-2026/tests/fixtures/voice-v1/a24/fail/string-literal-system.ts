/**
 * A24 fixture — fail.
 *
 * `system` is a hand-rolled string literal. Exactly the shape A24
 * exists to prevent — no voice seed, no cache key, no trace of
 * doctrine.
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

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 100,
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "hi" }],
  });
}
