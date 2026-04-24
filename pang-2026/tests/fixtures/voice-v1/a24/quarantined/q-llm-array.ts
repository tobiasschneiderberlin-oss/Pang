/**
 * A24 fixture — quarantined (exempt).
 *
 * The CaMeL Q-LLM path. `system` carries a quarantined role prompt,
 * not the voice seed. A24 recognises the `QUARANTINED_SYSTEM_PROMPT`
 * suffix and skips the site entirely — mixing the voice seed into
 * an untrusted-extraction role would defeat A7/A8.
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

const QUARANTINED_SYSTEM_PROMPT = "extract only the fields named in the tool schema";

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: [
      {
        type: "text",
        text: QUARANTINED_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: "<untrusted>...</untrusted>" }],
  });
}
