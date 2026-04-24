/**
 * A24 fixture — quarantined (exempt), prefixed identifier.
 *
 * A prefix on the quarantined marker (e.g. `ENRICHMENT_QUARANTINED_SYSTEM_PROMPT`)
 * is still recognised — A24 matches on the suffix so per-agent
 * Q-LLMs keep their descriptive names.
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

const ENRICHMENT_QUARANTINED_SYSTEM_PROMPT = "extract only the fields named in the tool schema";

export async function run(): Promise<unknown> {
  return client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: [
      {
        type: "text",
        text: ENRICHMENT_QUARANTINED_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: "<untrusted>...</untrusted>" }],
  });
}
