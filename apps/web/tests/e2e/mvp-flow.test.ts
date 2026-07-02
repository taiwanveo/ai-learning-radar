import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/auth/login/route";
import { GET as listRuns } from "@/app/api/admin/runs/route";
import { POST as triggerRun } from "@/app/api/admin/runs/trigger/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/admin/settings/route";
import { GET as getDigest } from "@/app/api/public/digest/route";
import { POST as createLearningPath } from "@/app/api/public/learning-path/route";
import { scoreQuiz } from "@/components/public/quiz/quiz";
import { publicDigestResponseSchema } from "@/lib/schemas";
import { resetManualRunRateLimit } from "@/server/admin/http";
import {
  MemoryAdminRepository,
  resetAdminRepository,
  setAdminRepository,
} from "@/server/admin/repository";
import {
  configureAuthRepository,
  hashPassword,
  MemoryAuthRepository,
} from "@/server/auth";
import { resetAuthRepositoryForTests } from "@/server/auth/repository";
import { demoContent } from "@/server/public/demo-content";
import { getContentDetail, searchContent } from "@/server/public/repository";
import { learningPathResponseSchema } from "@/server/public/types";

const originalDemoContent = structuredClone(demoContent);
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;

function installTwentyDemoItems() {
  const items = Array.from({ length: 20 }, (_, index) => {
    const source = originalDemoContent[index % originalDemoContent.length];
    const suffix = String(index + 1).padStart(12, "0");
    return {
      ...structuredClone(source),
      id: `20000000-0000-4000-8001-${suffix}`,
      title: `${source.title} #${index + 1}`,
      viewCount: source.viewCount + index,
      radarScore: 1 - index / 100,
      publishedAt: `2026-06-${String(30 - index).padStart(2, "0")}T02:00:00.000Z`,
    };
  });
  demoContent.splice(0, demoContent.length, ...items);
}

function request(url: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  return new Request(url, { ...init, headers });
}

async function loginAsOwner() {
  const admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    name: "Owner",
    passwordHash: await hashPassword("correct horse battery staple"),
    role: "owner" as const,
    isActive: true,
  };
  configureAuthRepository(new MemoryAuthRepository([admin]));
  const response = await login(new Request("http://localhost/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "correct horse battery staple" }),
  }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  expect(cookie).toMatch(/^ai_radar_admin_session=/);
  return cookie!;
}

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.ADMIN_SESSION_SECRET = "e2e-session-secret-that-is-at-least-32-characters";
  resetAuthRepositoryForTests();
  resetAdminRepository();
  resetManualRunRateLimit();
  demoContent.splice(0, demoContent.length, ...structuredClone(originalDemoContent));
});

afterEach(() => {
  resetAuthRepositoryForTests();
  resetAdminRepository();
  resetManualRunRateLimit();
  demoContent.splice(0, demoContent.length, ...structuredClone(originalDemoContent));
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
});

describe("MVP end-to-end contracts", () => {
  it("serves exactly the ranked Top 20 from the repository fixture", async () => {
    installTwentyDemoItems();

    const response = await getDigest(new Request(
      "http://localhost/api/public/digest?topic=artificial-intelligence&sort=recommended&limit=20",
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-data-source")).toBe("demo");

    const digest = publicDigestResponseSchema.parse(await response.json());
    expect(digest.items).toHaveLength(20);
    expect(new Set(digest.items.map(({ id }) => id)).size).toBe(20);
    expect(digest.items.map(({ radarScore }) => radarScore)).toEqual(
      [...digest.items.map(({ radarScore }) => radarScore)].sort((a, b) => (b ?? 0) - (a ?? 0)),
    );
    expect(digest.items.every((item) => item.quizCount === 3)).toBe(true);
  });

  it("loads a detail quiz and scores anonymous answers without persistence", async () => {
    const detail = await getContentDetail(originalDemoContent[0].id);
    expect(detail?.source).toBe("demo");
    const quiz = detail?.data.quiz;
    expect(quiz?.questions).toHaveLength(3);

    const correctAnswers = Object.fromEntries(
      quiz!.questions.map((question, index) => [question.id ?? String(index), question.correctOptionKey]),
    );
    const oneWrong = { ...correctAnswers, [quiz!.questions[0].id!]: "D" };
    expect(scoreQuiz(quiz!, correctAnswers)).toBe(3);
    expect(scoreQuiz(quiz!, oneWrong)).toBe(2);
    expect(scoreQuiz(quiz!, {})).toBe(0);
  });

  it("keeps generated learning paths inside the submitted search result scope", async () => {
    const search = await searchContent({ q: "AI", difficulty: "all", limit: 25 });
    expect(search.data.length).toBeGreaterThanOrEqual(3);
    const allowedIds = search.data.slice(0, 3).map(({ id }) => id);

    const response = await createLearningPath(new Request(
      "http://localhost/api/public/learning-path",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "AI", difficulty: "all", contentItemIds: allowedIds }),
      },
    ));
    expect(response.status).toBe(200);
    const path = learningPathResponseSchema.parse(await response.json());
    expect(path.recommended_order).toHaveLength(3);
    expect(path.recommended_order.every(({ content_item_id }) => allowedIds.includes(content_item_id))).toBe(true);

    const insufficient = await createLearningPath(new Request(
      "http://localhost/api/public/learning-path",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "AI",
          difficulty: "all",
          contentItemIds: [...allowedIds.slice(0, 2), "90000000-0000-4000-8000-000000000001"],
        }),
      },
    ));
    expect(insufficient.status).toBe(422);
  });

  it("authenticates an admin, mutates topic settings, and exposes the queued run log", async () => {
    const repository = new MemoryAdminRepository();
    setAdminRepository(repository);
    const cookie = await loginAsOwner();
    const topicId = "30000000-0000-4000-8000-000000000001";
    const settings = {
      topicId,
      freshnessDays: 90,
      candidateLimit: 50,
      topN: 20,
      minDurationSeconds: 300,
      maxDurationSeconds: 7200,
      excludeShorts: true,
      minViewCount: 0,
      minEngagementScore: 0.05,
      growthGuardrailEnabled: false,
      minViewsPerDay: 250,
      autoPublish: true,
      youtubeRegionCode: "tw",
      relevanceLanguage: "zh-Hant",
      searchOrder: "relevance",
      scheduleCron: "0 21 * * *",
    };

    const mutation = await patchSettings(request(
      "http://localhost/api/admin/settings",
      cookie,
      { method: "PATCH", body: JSON.stringify(settings) },
    ));
    expect(mutation.status).toBe(200);
    expect((await mutation.json()).settings).toMatchObject({ topicId, topN: 20, youtubeRegionCode: "TW" });

    const readback = await getSettings(request(
      `http://localhost/api/admin/settings?topicId=${topicId}`,
      cookie,
    ));
    expect(readback.status).toBe(200);
    expect((await readback.json()).settings).toHaveLength(1);

    const triggered = await triggerRun(request(
      "http://localhost/api/admin/runs/trigger",
      cookie,
      { method: "POST" },
    ));
    expect(triggered.status).toBe(202);
    const run = (await triggered.json()).run;
    expect(run).toMatchObject({ status: "queued", trigger: "manual" });

    const log = await listRuns(request("http://localhost/api/admin/runs", cookie));
    expect(log.status).toBe(200);
    expect((await log.json()).runs).toEqual([run]);
    expect(await repository.listAuditLogs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "update", entityType: "topic_search_settings", entityId: topicId }),
        expect.objectContaining({ action: "trigger", entityType: "agent_run", entityId: run.id }),
      ]),
    );
  });
});
