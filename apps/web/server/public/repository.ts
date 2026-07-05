import { Prisma, PrismaClient } from "@prisma/client";
import type { Decimal, JsonValue } from "@prisma/client/runtime/library";
import { contentDetailSchema, publicDigestItemSchema, publicDigestResponseSchema } from "@/lib/schemas";
import { demoContent } from "./demo-content";
import type { ContentDetail, DigestItem, DigestQuery, DigestResponse, PublicData, SearchQuery } from "./types";

const contentInclude = {
  channel: { select: { listType: true, handle: true, sourceChannelId: true } },
  youtubeStats: { orderBy: { fetchedAt: "desc" as const }, take: 1 },
  scores: { orderBy: { calculatedAt: "desc" as const }, take: 1 },
  summaries: { orderBy: { createdAt: "desc" as const }, take: 1 },
  learningObjectives: { orderBy: { sortOrder: "asc" as const } },
  tags: { include: { tag: true } },
  topics: { include: { topic: true } },
  quizzes: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      questions: { orderBy: { sortOrder: "asc" as const }, include: { options: true } },
    },
  },
} as const;

function fetchContentItems(prisma: PrismaClient) {
  return prisma.contentItem.findMany({ include: contentInclude });
}

type DatabaseContent = Awaited<ReturnType<typeof fetchContentItems>>[number];

const globalPrisma = globalThis as unknown as { publicPrisma?: PrismaClient };

function database(): PrismaClient {
  if (!globalPrisma.publicPrisma) globalPrisma.publicPrisma = new PrismaClient();
  return globalPrisma.publicPrisma;
}

function numeric(value: bigint | Decimal | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function rawString(raw: JsonValue | undefined, key: string): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function channelUrl(channel: { handle: string | null; sourceChannelId: string } | null | undefined): string | null {
  if (!channel) return null;
  if (channel.handle) return `https://www.youtube.com/${channel.handle.replace(/^@?/, "@")}`;
  if (channel.sourceChannelId) return `https://www.youtube.com/channel/${channel.sourceChannelId}`;
  return null;
}

function toDetail(row: DatabaseContent): ContentDetail {
  const stats = row.youtubeStats[0];
  const score = row.scores[0];
  const summary = row.summaries[0];
  const latestQuiz = row.quizzes[0];
  const optionKeys = ["A", "B", "C", "D"] as const;
  const questions = latestQuiz?.questions.map((question: any) => ({
    id: question.id,
    questionType: question.questionType as "comprehension" | "application" | "concept",
    questionText: question.questionText,
    options: Object.fromEntries(optionKeys.map((key) => [key, question.options.find((option: any) => option.optionKey === key)?.optionText ?? key])) as Record<(typeof optionKeys)[number], string>,
    correctOptionKey: question.correctOptionKey as (typeof optionKeys)[number],
    explanation: question.explanation,
    evidenceText: question.evidenceText.slice(0, 80),
    sortOrder: question.sortOrder,
  })) ?? [];

  return contentDetailSchema.parse({
    id: row.id,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    channelTitle: row.channelTitle,
    channelUrl: channelUrl(row.channel),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    viewCount: numeric(stats?.viewCount),
    likeCount: numeric(stats?.likeCount),
    commentCount: numeric(stats?.commentCount),
    engagementScore: numeric(score?.engagementScore),
    freshEngagementScore: numeric(score?.freshEngagementScore),
    radarScore: score?.radarScore == null ? null : numeric(score.radarScore),
    difficulty: row.difficulty,
    contentType: rawString(summary?.rawJson, "content_type") ?? undefined,
    language: row.language,
    isRecommendedChannel: row.channel?.listType === "recommended",
    isPinned: Boolean(row.isPinned),
    tags: row.tags.map(({ tag }: any) => tag.name),
    suitableFor: summary?.suitableFor ?? "希望快速掌握這個主題的學習者",
    shortSummary: summary?.shortSummary ?? row.description ?? "此內容尚待補充摘要。",
    learningObjectives: row.learningObjectives.length ? row.learningObjectives.map(({ objectiveText }: any) => objectiveText) : ["掌握影片介紹的核心概念"],
    quizCount: questions.length,
    description: row.description,
    durationSeconds: row.durationSeconds,
    fullSummary: summary?.fullSummary ?? summary?.shortSummary ?? row.description ?? "此內容尚待補充完整摘要。",
    transcriptSummary: summary?.transcriptSummary ?? null,
    limitationsOrCautions: rawString(summary?.rawJson, "limitations_or_cautions"),
    topicNames: row.topics.map(({ topic }: any) => topic.nameZhHant),
    quiz: questions.length === 3 ? { id: latestQuiz?.id, questions } : null,
  });
}

function digestItem(content: ContentDetail): DigestItem {
  const { description: _description, durationSeconds: _duration, fullSummary: _full, transcriptSummary: _transcript, limitationsOrCautions: _limitations, topicNames: _topics, quiz: _quiz, ...item } = content;
  return publicDigestItemSchema.parse(item);
}

function applyDemoFilters(
  items: ContentDetail[],
  query: DigestQuery,
  // With ranked snapshot input, the default sort keeps the snapshot rank order.
  preserveDefaultOrder = false,
): ContentDetail[] {
  const end = query.date ? new Date(`${query.date}T23:59:59.999+08:00`).getTime() : Number.POSITIVE_INFINITY;
  const publishedAfter = query.published === "all"
    ? Number.NEGATIVE_INFINITY
    : (query.date ? new Date(`${query.date}T23:59:59.999+08:00`).getTime() : Date.now()) - Number(query.published.slice(0, -1)) * 86_400_000;
  const filtered = items.filter((item) => {
    if (item.publishedAt) {
      const publishedAt = new Date(item.publishedAt).getTime();
      if (publishedAt > end || publishedAt < publishedAfter) return false;
    } else if (query.published !== "all") {
      return false;
    }
    if (query.difficulty !== "all" && item.difficulty !== query.difficulty) return false;
    if (query.language && item.language !== query.language) return false;
    if (query.recommended !== "all" && item.isRecommendedChannel !== (query.recommended === "true")) return false;
    if (query.contentType === "video" && item.sourceType !== "youtube") return false;
    if (query.contentType === "article" && item.sourceType !== "article") return false;
    const topicNeedle = query.topic.toLowerCase().replaceAll("-", " ");
    return query.topic === "artificial-intelligence" || item.topicNames.some((topic) => topic.toLowerCase().includes(topicNeedle));
  });
  const sorted = query.sort === "default" && preserveDefaultOrder ? filtered : filtered.sort((a, b) => {
    if (query.sort === "views" || query.sort === "popular") return b.viewCount - a.viewCount;
    if (query.sort === "engagement") return b.engagementScore - a.engagementScore;
    if (query.sort === "newest" || query.sort === "latest") return Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0");
    if (query.sort === "beginner") {
      const difficultyOrder = Number(b.difficulty === "beginner") - Number(a.difficulty === "beginner");
      return difficultyOrder || (b.radarScore ?? b.freshEngagementScore) - (a.radarScore ?? a.freshEngagementScore);
    }
    return (b.radarScore ?? b.freshEngagementScore) - (a.radarScore ?? a.freshEngagementScore);
  });
  // Admin-pinned items always surface first, keeping their relative order.
  return [...sorted.filter((item) => item.isPinned), ...sorted.filter((item) => !item.isPinned)].slice(0, query.limit);
}

export type PublicTopic = { slug: string; name: string };

const demoTopics: PublicTopic[] = [
  { slug: "rag", name: "RAG" },
  { slug: "ai-agent", name: "AI Agent" },
  { slug: "prompt-engineering", name: "提示工程" },
  { slug: "llm", name: "LLM" },
];

export async function listPublicTopics(): Promise<PublicData<PublicTopic[]>> {
  if (!process.env.DATABASE_URL) return { source: "demo", data: demoTopics };
  const rows = await database().topic.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { nameZhHant: "asc" }], select: { slug: true, nameZhHant: true } });
  return { source: "database", data: rows.map((row: { slug: string; nameZhHant: string }) => ({ slug: row.slug, name: row.nameZhHant })) };
}

export async function getDigest(query: DigestQuery): Promise<PublicData<DigestResponse>> {
  const date = query.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  if (!process.env.DATABASE_URL) {
    return {
      source: "demo",
      data: publicDigestResponseSchema.parse({
        date,
        topic: { id: "30000000-0000-4000-8000-000000000001", slug: query.topic, name: query.topic === "artificial-intelligence" ? "人工智慧" : query.topic },
        items: applyDemoFilters(demoContent, query).map(digestItem),
      }),
    };
  }

  const topic = await database().topic.findUnique({ where: { slug: query.topic }, select: { id: true, slug: true, nameZhHant: true } });
  if (!topic) {
    return { source: "database", data: publicDigestResponseSchema.parse({ date, topic: { id: "00000000-0000-4000-8000-000000000000", slug: query.topic, name: query.topic }, items: [] }) };
  }
  const dateEnd = new Date(`${date}T23:59:59.999+08:00`);

  // The worker writes a ranked Top-N snapshot per topic per day; the digest
  // serves the latest snapshot at or before the requested date and falls back
  // to the raw published list only when no snapshot exists yet.
  const snapshot = await database().dailyDigestSnapshot.findFirst({
    where: { topicId: topic.id, snapshotDate: { lte: dateEnd } },
    orderBy: { snapshotDate: "desc" },
    include: { items: { orderBy: { rank: "asc" }, include: { contentItem: { include: contentInclude } } } },
  });
  let rows: DatabaseContent[];
  if (snapshot) {
    rows = snapshot.items.map((item: any) => item.contentItem).filter((row: DatabaseContent) => row.status === "published");
  } else {
    rows = await database().contentItem.findMany({
      where: {
        status: "published",
        publishedAt: { lte: dateEnd },
        topics: { some: { topicId: topic.id } },
      },
      include: contentInclude,
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
  }
  // Pinned published content in this topic always joins the digest, even when
  // it did not make the day's snapshot.
  const pinned = await database().contentItem.findMany({
    where: {
      status: "published",
      isPinned: true,
      topics: { some: { topicId: topic.id } },
      OR: [{ publishedAt: { lte: dateEnd } }, { publishedAt: null }],
    },
    include: contentInclude,
  });
  const seen = new Set(rows.map((row: DatabaseContent) => row.id));
  rows = [...rows, ...pinned.filter((row: DatabaseContent) => !seen.has(row.id))];
  const details = rows.map(toDetail);
  return {
    source: "database",
    data: publicDigestResponseSchema.parse({ date, topic: { id: topic.id, slug: topic.slug, name: topic.nameZhHant }, items: applyDemoFilters(details, { ...query, topic: "artificial-intelligence" }, Boolean(snapshot)).map(digestItem) }),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getContentDetail(id: string): Promise<PublicData<ContentDetail> | null> {
  if (!UUID_PATTERN.test(id)) return null;
  if (!process.env.DATABASE_URL) {
    const content = demoContent.find((item) => item.id === id);
    return content ? { source: "demo", data: contentDetailSchema.parse(content) } : null;
  }
  const row = await database().contentItem.findFirst({ where: { id, status: "published" }, include: contentInclude });
  return row ? { source: "database", data: toDetail(row) } : null;
}

function textMatches(item: ContentDetail, query: string): boolean {
  const text = [item.title, item.channelTitle, item.shortSummary, item.fullSummary, item.transcriptSummary, ...item.tags, ...item.learningObjectives].filter(Boolean).join(" ").toLocaleLowerCase("zh-Hant");
  return query.toLocaleLowerCase("zh-Hant").split(/\s+/).every((token) => text.includes(token));
}

export async function searchContent(query: SearchQuery): Promise<PublicData<ContentDetail[]>> {
  if (!query.q) return { source: process.env.DATABASE_URL ? "database" : "demo", data: [] };
  if (!process.env.DATABASE_URL) {
    const data = demoContent.filter((item) => textMatches(item, query.q) && (query.difficulty === "all" || item.difficulty === query.difficulty)).slice(0, query.limit);
    return { source: "demo", data };
  }
  const tokenMatches = (token: string) => {
    const contains = { contains: token, mode: "insensitive" as const };
    return {
      OR: [
        { title: contains }, { channelTitle: contains }, { description: contains },
        { summaries: { some: { OR: [{ shortSummary: contains }, { fullSummary: contains }, { transcriptSummary: contains }] } } },
        { tags: { some: { tag: { name: contains } } } },
        { learningObjectives: { some: { objectiveText: contains } } },
      ],
    };
  };
  const rows = await database().contentItem.findMany({
    where: {
      status: "published",
      ...(query.difficulty === "all" ? {} : { difficulty: query.difficulty }),
      AND: query.q.split(/\s+/).filter(Boolean).map(tokenMatches),
    },
    include: contentInclude,
    orderBy: { publishedAt: "desc" },
    take: query.limit,
  });
  return { source: "database", data: rows.map(toDetail) };
}
