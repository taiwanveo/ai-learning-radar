import { demoContents, demoQuizQuestions, validateDemoData } from "./demo-data.mjs";

validateDemoData();

if (process.argv.includes("--check")) {
  console.log(`Demo data valid: ${demoContents.length} contents, ${demoQuizQuestions.length} questions per quiz.`);
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function questionCreate(question, sortOrder) {
  return {
    questionType: "single_choice",
    questionText: question.questionText,
    correctOptionKey: question.correctOptionKey,
    explanation: question.explanation,
    evidenceText: question.evidenceText,
    sortOrder,
    options: {
      create: Object.entries(question.options).map(([optionKey, optionText]) => ({ optionKey, optionText })),
    },
  };
}

try {
  const topic = await prisma.topic.findUnique({ where: { slug: "artificial-intelligence" } });
  if (!topic) throw new Error("Run npm run db:seed before db:seed:demo.");

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.dailyDigestSnapshot.upsert({
      where: {
        topicId_snapshotDate_rankingMethod: {
          topicId: topic.id,
          snapshotDate: new Date("2026-07-02T00:00:00.000Z"),
          rankingMethod: "demo_fixture",
        },
      },
      update: {},
      create: {
        topicId: topic.id,
        snapshotDate: new Date("2026-07-02T00:00:00.000Z"),
        rankingMethod: "demo_fixture",
      },
    });

    await tx.dailyDigestItem.deleteMany({ where: { snapshotId: snapshot.id } });

    for (const [index, item] of demoContents.entries()) {
      const content = await tx.contentItem.upsert({
        where: { sourceType_sourceContentId: { sourceType: "manual", sourceContentId: item.fixtureId } },
        update: {
          title: item.title,
          channelTitle: item.channelTitle,
          publishedAt: item.publishedAt,
          durationSeconds: item.durationSeconds,
          status: "published",
          difficulty: item.difficulty,
          language: "zh-Hant",
          isTutorial: true,
        },
        create: {
          sourceType: "manual",
          sourceContentId: item.fixtureId,
          sourceUrl: `https://example.com/ai-learning-radar/fixtures/${item.fixtureId}`,
          title: item.title,
          description: "AI Learning Radar 本機示範資料，不對應任何真實影片。",
          channelTitle: item.channelTitle,
          publishedAt: item.publishedAt,
          durationSeconds: item.durationSeconds,
          status: "published",
          difficulty: item.difficulty,
          language: "zh-Hant",
          isTutorial: true,
          tutorialConfidence: "1.0000",
          rawMetadataJson: { fixture: true, source: "demo-seed" },
        },
      });

      await Promise.all([
        tx.youtubeVideoStat.deleteMany({ where: { contentItemId: content.id } }),
        tx.contentScore.deleteMany({ where: { contentItemId: content.id } }),
        tx.contentSummary.deleteMany({ where: { contentItemId: content.id } }),
        tx.learningObjective.deleteMany({ where: { contentItemId: content.id } }),
        tx.quiz.deleteMany({ where: { contentItemId: content.id } }),
      ]);

      const tag = await tx.tag.upsert({
        where: { normalizedName: item.tag.toLocaleLowerCase("zh-Hant") },
        update: { name: item.tag },
        create: { name: item.tag, normalizedName: item.tag.toLocaleLowerCase("zh-Hant") },
      });

      await tx.contentTopic.upsert({
        where: { contentItemId_topicId: { contentItemId: content.id, topicId: topic.id } },
        update: { relevanceScore: "0.950000", source: "demo-seed" },
        create: { contentItemId: content.id, topicId: topic.id, relevanceScore: "0.950000", source: "demo-seed" },
      });
      await tx.contentTag.upsert({
        where: { contentItemId_tagId: { contentItemId: content.id, tagId: tag.id } },
        update: { confidence: "1.0000", source: "demo-seed" },
        create: { contentItemId: content.id, tagId: tag.id, confidence: "1.0000", source: "demo-seed" },
      });
      await tx.youtubeVideoStat.create({
        data: {
          contentItemId: content.id,
          viewCount: item.viewCount,
          likeCount: item.likeCount,
          commentCount: item.commentCount,
          fetchedAt: new Date("2026-07-02T03:00:00.000Z"),
        },
      });
      await tx.contentScore.create({
        data: {
          contentItemId: content.id,
          topicId: topic.id,
          ageDays: index + 1,
          engagementScore: item.engagementScore,
          freshEngagementScore: item.freshEngagementScore,
          viewVelocity: String(Math.round(Number(item.viewCount) / (index + 1))),
          commentSignal: "0.500000",
          topicRelevanceScore: "0.950000",
          tutorialQualityScore: "0.900000",
          radarScore: item.radarScore,
          calculatedAt: new Date("2026-07-02T03:05:00.000Z"),
        },
      });
      await tx.contentSummary.create({
        data: {
          contentItemId: content.id,
          promptVersion: "demo-v1",
          provider: "fixture",
          modelId: "fixture",
          suitableFor: item.suitableFor,
          shortSummary: item.shortSummary,
          fullSummary: item.fullSummary,
          transcriptSummary: "示範逐字稿摘要：核心概念、操作步驟與延伸練習。",
          rawJson: { fixture: true },
        },
      });
      await tx.learningObjective.createMany({
        data: [
          { contentItemId: content.id, objectiveText: item.focus, sortOrder: 0 },
          { contentItemId: content.id, objectiveText: "能以自己的案例完成一次實作", sortOrder: 1 },
          { contentItemId: content.id, objectiveText: "能辨識常見錯誤並驗證結果", sortOrder: 2 },
        ],
      });
      await tx.quiz.create({
        data: {
          contentItemId: content.id,
          promptVersion: "demo-v1",
          provider: "fixture",
          modelId: "fixture",
          questions: { create: demoQuizQuestions.map(questionCreate) },
        },
      });
      await tx.dailyDigestItem.create({
        data: {
          snapshotId: snapshot.id,
          contentItemId: content.id,
          rank: index + 1,
          score: item.radarScore,
        },
      });
    }
  }, { timeout: 30_000 });

  console.log(`Seeded ${demoContents.length} visibly marked demo contents and a 20-item snapshot.`);
} finally {
  await prisma.$disconnect();
}
