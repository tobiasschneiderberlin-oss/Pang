/**
 * PANG — /api/narrative/current route tests (iter #14).
 *
 * The route drives:
 *
 *   - GET: session-gated marker read (204 on absent or skipped,
 *          200 + body on paragraph).
 *   - POST: assemble → hash → route agent → commit marker.
 *
 * Strategy mirrors `app/api/verification/dispatch/route.test.ts`:
 * install the `next/headers` mock, mock `@/ai/agents/narrative` before
 * the route module is imported, seed the auth session, and exercise
 * the handler directly.
 *
 * Every test uses `PANG_NARRATIVE_STORE_DIR` to redirect the marker
 * store into a tmpdir, preventing cross-test leakage.
 */

import {
  describe,
  it,
  before,
  beforeEach,
  after,
  mock,
} from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { installNextHeadersMock } from "@/test/next-headers-mock";
import { seedSession } from "@/test/seed-session";
import { __resetAuthStoresForTests } from "@/auth/server/store";
import { brand } from "@/ai/camel/trust";
import type {
  NarrativeTickResponse,
  NarrativeCurrentResponse,
} from "@/narrative/schema";

// ---- tmpdir marker store -----------------------------------------

const TMP_ROOT = mkdtempSync(path.join(os.tmpdir(), "pang-narrative-route-"));
const PRIOR_ENV = process.env["PANG_NARRATIVE_STORE_DIR"];
process.env["PANG_NARRATIVE_STORE_DIR"] = TMP_ROOT;

// ---- headers mock -------------------------------------------------

const jar = installNextHeadersMock();

// ---- narrative agent mock ----------------------------------------

interface AgentMockState {
  output: { paragraph: string } | null;
  calls: number;
  throws: Error | null;
  lastInput: unknown;
}
const agentMock: AgentMockState = {
  output: null,
  calls: 0,
  throws: null,
  lastInput: null,
};

function setAgentOutput(paragraph: string): void {
  agentMock.output = { paragraph };
  agentMock.calls = 0;
  agentMock.throws = null;
}

function setAgentNull(): void {
  agentMock.output = null;
  agentMock.calls = 0;
  agentMock.throws = null;
}

function setAgentThrow(err: Error): void {
  agentMock.output = null;
  agentMock.calls = 0;
  agentMock.throws = err;
}

mock.module("@/ai/agents/narrative", {
  namedExports: {
    runNarrative: async (input: unknown) => {
      agentMock.calls += 1;
      agentMock.lastInput = input;
      if (agentMock.throws !== null) throw agentMock.throws;
      if (agentMock.output === null) return null;
      return brand(agentMock.output, "P");
    },
    RETRY_POLICY: {
      maxRetries: 2,
      onTerminalFailure: "null",
      temperatures: [0.2, 0.4, 0.6],
    } as const,
    EVAL_THRESHOLD: 0.85,
  },
});

const { GET, POST } = await import("./route");

// ---- fixtures ----------------------------------------------------

const NOMINAL_PARAGRAPH =
  "Four Hojgaards sit on the west wall, the largest acquired in 2019. Next to them is a single Taeuber-Arp from 1935, the only work on paper in this collection. The provenance ledger for both names continues to grow year on year.";

function threeWorkBody(collectorId: string): {
  collectorId: string;
  verifiedWorks: Array<{
    id: string;
    title: string;
    artistId: string;
    artist: string;
    year: number | null;
    medium: string | null;
  }>;
  provenanceEntries: Array<{
    workId: string;
    kind: string;
    year: number | null;
    summary: string;
  }>;
  bioMujiParagraphs: Record<string, string>;
} {
  return {
    collectorId,
    verifiedWorks: [
      {
        id: "w-1",
        title: "Abstraktes Bild",
        artistId: "richter",
        artist: "Gerhard Richter",
        year: 1992,
        medium: "oil on canvas",
      },
      {
        id: "w-2",
        title: "Kerze",
        artistId: "richter",
        artist: "Gerhard Richter",
        year: 1982,
        medium: "oil on canvas",
      },
      {
        id: "w-3",
        title: "Composition",
        artistId: "taeuber-arp",
        artist: "Sophie Taeuber-Arp",
        year: 1935,
        medium: "gouache on paper",
      },
    ],
    provenanceEntries: [
      {
        workId: "w-1",
        kind: "acquisition",
        year: 2019,
        summary: "Acquired via Galerie Droste.",
      },
    ],
    bioMujiParagraphs: {
      richter: "A concise factual bio paragraph about Richter.",
      "taeuber-arp": "A factual bio paragraph about Taeuber-Arp.",
    },
  };
}

function emptyBody(collectorId: string): {
  collectorId: string;
  verifiedWorks: never[];
  provenanceEntries: never[];
  bioMujiParagraphs: Record<string, string>;
} {
  return {
    collectorId,
    verifiedWorks: [],
    provenanceEntries: [],
    bioMujiParagraphs: {},
  };
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/narrative/current", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ---- lifecycle ---------------------------------------------------

before(async () => {
  await __resetAuthStoresForTests();
});

beforeEach(async () => {
  // Fresh store per test.
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });
  // Fresh session per test.
  await __resetAuthStoresForTests();
  jar.clear();
  setAgentOutput(NOMINAL_PARAGRAPH);
});

after(() => {
  if (PRIOR_ENV === undefined) delete process.env["PANG_NARRATIVE_STORE_DIR"];
  else process.env["PANG_NARRATIVE_STORE_DIR"] = PRIOR_ENV;
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

// ---- GET ---------------------------------------------------------

describe("GET /api/narrative/current — auth", () => {
  it("returns 401 when the session cookie is missing", async () => {
    const res = await GET();
    assert.equal(res.status, 401);
  });
});

describe("GET /api/narrative/current — no marker", () => {
  it("returns 204 when the month is unset", async () => {
    await seedSession(jar);
    const res = await GET();
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");
  });
});

describe("GET /api/narrative/current — paragraph + skipped", () => {
  it("returns 200 + paragraph body when a paragraph marker exists", async () => {
    const { user } = await seedSession(jar);
    // POST first to land a paragraph marker.
    const postRes = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(postRes.status, 200);
    const tick = (await postRes.json()) as NarrativeTickResponse;
    assert.equal(tick.kind, "generated");

    const res = await GET();
    assert.equal(res.status, 200);
    const body = (await res.json()) as NarrativeCurrentResponse;
    assert.equal(body.paragraph, NOMINAL_PARAGRAPH);
    assert.match(body.month, /^\d{4}-\d{2}$/);
  });

  it("returns 204 (silence) when the month's marker is 'skipped'", async () => {
    const { user } = await seedSession(jar);
    // POST with an empty collection → assembler skips.
    const postRes = await POST(postRequest(emptyBody(user.userId)));
    assert.equal(postRes.status, 200);
    const tick = (await postRes.json()) as NarrativeTickResponse;
    assert.equal(tick.kind, "skipped");

    const res = await GET();
    assert.equal(res.status, 204);
  });
});

// ---- POST auth + validation --------------------------------------

describe("POST /api/narrative/current — auth + validation", () => {
  it("returns 401 when the session cookie is missing", async () => {
    const res = await POST(postRequest(threeWorkBody("collector-x")));
    assert.equal(res.status, 401);
  });

  it("returns 400 on unparseable JSON", async () => {
    await seedSession(jar);
    const res = await POST(postRequest("not-json"));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "bad_json");
  });

  it("returns 400 on a schema-invalid body", async () => {
    await seedSession(jar);
    const res = await POST(
      postRequest({ collectorId: "", verifiedWorks: [], provenanceEntries: [] }),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "schema");
  });

  it("returns 403 when collectorId ≠ session userId", async () => {
    await seedSession(jar);
    const res = await POST(postRequest(threeWorkBody("not-my-id")));
    assert.equal(res.status, 403);
  });
});

// ---- POST happy path + cache + skip branches ---------------------

describe("POST /api/narrative/current — generate", () => {
  it("runs the agent and returns 'generated' with a paragraphLength", async () => {
    const { user } = await seedSession(jar);
    const res = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(res.status, 200);
    const body = (await res.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "generated");
    if (body.kind === "generated") {
      assert.equal(body.paragraphLength, NOMINAL_PARAGRAPH.length);
      assert.match(body.month, /^\d{4}-\d{2}$/);
    }
    assert.equal(agentMock.calls, 1);
  });
});

describe("POST /api/narrative/current — same-month short-circuit", () => {
  it("returns 'cached' on the second tick in the same month", async () => {
    const { user } = await seedSession(jar);
    const first = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(first.status, 200);
    assert.equal(agentMock.calls, 1);
    const second = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(second.status, 200);
    const body = (await second.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "cached");
    // Crucially — the agent was NOT called a second time.
    assert.equal(agentMock.calls, 1);
  });
});

describe("POST /api/narrative/current — assembler skip", () => {
  it("commits empty-collection skip and does not call the agent", async () => {
    const { user } = await seedSession(jar);
    const res = await POST(postRequest(emptyBody(user.userId)));
    assert.equal(res.status, 200);
    const body = (await res.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "skipped");
    if (body.kind === "skipped") {
      assert.equal(body.reason, "empty-collection");
    }
    assert.equal(agentMock.calls, 0);
  });

  it("commits thin-provenance skip on a below-threshold collection", async () => {
    const { user } = await seedSession(jar);
    const thin = {
      collectorId: user.userId,
      verifiedWorks: [
        {
          id: "w-1",
          title: "T",
          artistId: "a-1",
          artist: "A",
          year: 2000,
          medium: "oil",
        },
      ],
      provenanceEntries: [],
      bioMujiParagraphs: { "a-1": "short bio" },
    };
    const res = await POST(postRequest(thin));
    assert.equal(res.status, 200);
    const body = (await res.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "skipped");
    if (body.kind === "skipped") {
      assert.equal(body.reason, "thin-provenance");
    }
    assert.equal(agentMock.calls, 0);
  });
});

describe("POST /api/narrative/current — agent null", () => {
  it("commits 'agent-failure' skip marker", async () => {
    setAgentNull();
    const { user } = await seedSession(jar);
    const res = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(res.status, 200);
    const body = (await res.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "skipped");
    if (body.kind === "skipped") {
      assert.equal(body.reason, "agent-failure");
    }
    assert.equal(agentMock.calls, 1);
    // Second call should short-circuit on same-month skip marker.
    const second = await POST(postRequest(threeWorkBody(user.userId)));
    const body2 = (await second.json()) as NarrativeTickResponse;
    assert.equal(body2.kind, "skipped");
    assert.equal(agentMock.calls, 1);
  });
});

describe("POST /api/narrative/current — agent exception", () => {
  it("returns 502 and does not write a marker", async () => {
    setAgentThrow(new Error("capability-violation"));
    const { user } = await seedSession(jar);
    const res = await POST(postRequest(threeWorkBody(user.userId)));
    assert.equal(res.status, 502);
    // No marker was committed — a fresh POST should run again.
    setAgentOutput(NOMINAL_PARAGRAPH);
    const second = await POST(postRequest(threeWorkBody(user.userId)));
    const body = (await second.json()) as NarrativeTickResponse;
    assert.equal(body.kind, "generated");
  });
});
