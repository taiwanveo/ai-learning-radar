export const rootTopic = {
  slug: "artificial-intelligence",
  nameZhHant: "人工智慧",
  description: "人工智慧基礎、生成式 AI、機器學習與實務應用教學。",
  sortOrder: 0,
};

export const subtopics = [
  { slug: "ai-fundamentals", nameZhHant: "AI 入門", sortOrder: 10, keywords: [["AI 入門", "positive"], ["人工智慧入門", "tw_term"], ["人工智能入门", "cn_term"], ["AI fundamentals", "english"]] },
  { slug: "generative-ai", nameZhHant: "生成式 AI", sortOrder: 20, keywords: [["生成式 AI", "positive"], ["生成式人工智慧", "tw_term"], ["生成式人工智能", "cn_term"], ["Generative AI", "english"]] },
  { slug: "ai-assistants", nameZhHant: "ChatGPT / Claude / Gemini 使用教學", sortOrder: 30, keywords: [["ChatGPT 教學", "positive"], ["Claude 教學", "positive"], ["Gemini 教學", "positive"]] },
  { slug: "prompt-engineering", nameZhHant: "Prompt Engineering", sortOrder: 40, keywords: [["Prompt Engineering", "positive"], ["提示詞工程", "tw_term"], ["提示词工程", "cn_term"]] },
  { slug: "python-ai", nameZhHant: "Python AI 入門", sortOrder: 50, keywords: [["Python AI 入門", "positive"], ["Python 人工智慧", "tw_term"], ["Python 人工智能", "cn_term"]] },
  { slug: "machine-learning", nameZhHant: "Machine Learning 入門", sortOrder: 60, keywords: [["機器學習入門", "tw_term"], ["机器学习入门", "cn_term"], ["Machine Learning tutorial", "english"]] },
  { slug: "deep-learning", nameZhHant: "Deep Learning 入門", sortOrder: 70, keywords: [["深度學習入門", "tw_term"], ["深度学习入门", "cn_term"], ["Deep Learning tutorial", "english"]] },
  { slug: "llm", nameZhHant: "LLM 入門", sortOrder: 80, keywords: [["LLM 入門", "positive"], ["大型語言模型", "tw_term"], ["大语言模型", "cn_term"], ["Large Language Model", "english"]] },
  { slug: "rag", nameZhHant: "RAG 入門", sortOrder: 90, keywords: [["RAG 入門", "positive"], ["檢索增強生成", "tw_term"], ["检索增强生成", "cn_term"], ["Retrieval Augmented Generation", "english"]] },
  { slug: "ai-agent", nameZhHant: "AI Agent 入門", sortOrder: 100, keywords: [["AI Agent 入門", "positive"], ["AI 代理人", "tw_term"], ["智能体", "cn_term"], ["agentic AI", "english"]] },
  { slug: "ai-tools", nameZhHant: "AI 工具應用", sortOrder: 110, keywords: [["AI 工具教學", "positive"], ["人工智慧工具", "tw_term"], ["人工智能工具", "cn_term"]] },
  { slug: "ai-automation", nameZhHant: "AI 自動化工作流", sortOrder: 120, keywords: [["AI 自動化工作流", "positive"], ["AI 自動化流程", "tw_term"], ["AI 自动化工作流", "cn_term"], ["AI automation workflow", "english"]] },
];

export const rootKeywords = [
  ["人工智慧", "positive", 1.5],
  ["人工智能", "synonym", 1.5],
  ["AI 教學", "positive", 1.25],
  ["AI 教程", "cn_term", 1.25],
  ["Artificial Intelligence", "english", 1.0],
  ["Shorts", "negative", 1.0],
  ["娛樂", "negative", 0.75],
];

export const defaultSearchSettings = {
  freshnessDays: 90,
  candidateLimit: 50,
  topN: 20,
  minDurationSeconds: 300,
  maxDurationSeconds: 7200,
  excludeShorts: true,
  minViewCount: 0n,
  minEngagementScore: "0.020000",
  growthGuardrailEnabled: false,
  minViewsPerDay: 250,
  autoPublish: true,
  youtubeRegionCode: "TW",
  relevanceLanguage: "zh-Hant",
  searchOrder: "relevance",
  scheduleCron: "0 21 * * *",
};

export function validateSeedData() {
  if (rootTopic.nameZhHant !== "人工智慧") throw new Error("Root topic must be 人工智慧");
  if (subtopics.length !== 12) throw new Error("Expected the 12 PRD default subtopics");
  const slugs = [rootTopic.slug, ...subtopics.map(({ slug }) => slug)];
  if (new Set(slugs).size !== slugs.length) throw new Error("Topic slugs must be unique");
  const allowedTypes = new Set(["positive", "negative", "synonym", "tw_term", "cn_term", "english"]);
  for (const topic of subtopics) {
    if (!topic.keywords.length || topic.keywords.some(([, type]) => !allowedTypes.has(type))) {
      throw new Error(`Invalid keywords for ${topic.slug}`);
    }
  }
  if (defaultSearchSettings.topN > defaultSearchSettings.candidateLimit) {
    throw new Error("topN cannot exceed candidateLimit");
  }
}
