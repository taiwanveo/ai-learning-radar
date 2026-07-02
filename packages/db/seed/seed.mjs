import { defaultSearchSettings, rootKeywords, rootTopic, subtopics, validateSeedData } from "./seed-data.mjs";

validateSeedData();

if (process.argv.includes("--check")) {
  console.log(`Seed data valid: 1 root topic, ${subtopics.length} subtopics, default search settings.`);
  process.exit(0);
}

const ownerValues = [
  process.env.ADMIN_OWNER_EMAIL,
  process.env.ADMIN_OWNER_NAME,
  process.env.ADMIN_OWNER_PASSWORD_HASH,
];
const suppliedOwnerValues = ownerValues.filter(Boolean).length;
if (suppliedOwnerValues !== 0 && suppliedOwnerValues !== ownerValues.length) {
  throw new Error("Set all of ADMIN_OWNER_EMAIL, ADMIN_OWNER_NAME, and ADMIN_OWNER_PASSWORD_HASH, or none of them.");
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

async function upsertKeyword(tx, topicId, [keyword, keywordType, weight = 1]) {
  return tx.topicKeyword.upsert({
    where: { topicId_keyword_keywordType: { topicId, keyword, keywordType } },
    update: { weight, isActive: true },
    create: { topicId, keyword, keywordType, weight, isActive: true },
  });
}

try {
  await prisma.$transaction(async (tx) => {
    const parent = await tx.topic.upsert({
      where: { slug: rootTopic.slug },
      update: { ...rootTopic, isActive: true },
      create: { ...rootTopic, isActive: true },
    });

    await tx.topicSearchSetting.upsert({
      where: { topicId: parent.id },
      update: defaultSearchSettings,
      create: { topicId: parent.id, ...defaultSearchSettings },
    });

    for (const keyword of rootKeywords) await upsertKeyword(tx, parent.id, keyword);

    for (const { keywords, ...topic } of subtopics) {
      const child = await tx.topic.upsert({
        where: { slug: topic.slug },
        update: { ...topic, parentTopicId: parent.id, isActive: true },
        create: { ...topic, parentTopicId: parent.id, isActive: true },
      });
      for (const keyword of keywords) await upsertKeyword(tx, child.id, keyword);
    }

    if (suppliedOwnerValues === ownerValues.length) {
      const email = process.env.ADMIN_OWNER_EMAIL.trim().toLowerCase();
      const passwordHash = process.env.ADMIN_OWNER_PASSWORD_HASH;
      if (!email.includes("@")) throw new Error("ADMIN_OWNER_EMAIL must be a valid email address.");
      if (passwordHash.length < 20) throw new Error("ADMIN_OWNER_PASSWORD_HASH does not look like a password hash.");
      await tx.admin.upsert({
        where: { email },
        update: { name: process.env.ADMIN_OWNER_NAME, passwordHash, role: "owner", isActive: true },
        create: { email, name: process.env.ADMIN_OWNER_NAME, passwordHash, role: "owner", isActive: true },
      });
      console.log(`Owner admin ensured for ${email}.`);
    } else {
      console.log("Owner admin skipped; provide the three ADMIN_OWNER_* variables to create one.");
    }
  });
  console.log("Default AI taxonomy and search settings seeded.");
} finally {
  await prisma.$disconnect();
}
