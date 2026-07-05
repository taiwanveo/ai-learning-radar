export type AdminRole = "owner" | "admin" | "editor" | "viewer";
export type KeywordType = "positive" | "negative" | "synonym" | "tw_term" | "cn_term" | "english";

export interface AdminActor { id: string; role: AdminRole; email?: string }
export interface Keyword { id: string; keyword: string; keywordType: KeywordType; weight: number; isActive: boolean }
export interface Topic { id: string; slug: string; nameZhHant: string; description: string | null; parentTopicId: string | null; isActive: boolean; sortOrder: number; keywords: Keyword[] }
export interface SearchSettings { topicId: string; freshnessDays: number; candidateLimit: number; topN: number; minDurationSeconds: number; maxDurationSeconds: number; excludeShorts: boolean; minViewCount: number; minEngagementScore: number; growthGuardrailEnabled: boolean; minViewsPerDay: number; autoPublish: boolean; youtubeRegionCode: string; relevanceLanguage: string; searchOrder: "relevance" | "date" | "viewCount"; scheduleCron: string }

// Mirrors the TopicSearchSetting column defaults in packages/db/prisma/schema.prisma so
// every topic gets a usable search configuration the moment it's created.
export const DEFAULT_SEARCH_SETTINGS: Omit<SearchSettings, "topicId"> = {
  freshnessDays: 90,
  candidateLimit: 50,
  topN: 20,
  minDurationSeconds: 300,
  maxDurationSeconds: 7200,
  excludeShorts: true,
  minViewCount: 0,
  minEngagementScore: 0.02,
  growthGuardrailEnabled: false,
  minViewsPerDay: 250,
  autoPublish: true,
  youtubeRegionCode: "TW",
  relevanceLanguage: "zh-Hant",
  searchOrder: "relevance",
  scheduleCron: "0 21 * * *",
};
export interface Channel { id: string; sourceChannelId: string; handle: string | null; title: string; listType: "neutral" | "recommended" | "blacklisted"; trustWeight: number; recommendationReason: string | null; isActive: boolean }
export interface ContentItem { id: string; sourceContentId: string; sourceUrl: string; title: string; channelTitle: string | null; shortSummary: string; difficulty: "beginner" | "normal"; tags: string[]; status: "discovered" | "published" | "hidden" | "deleted"; hiddenReason: string | null; isPinned: boolean; topicId: string | null; createdAt: string }
export interface RunEvent { id: string; phase: string; level: "info" | "warning" | "error"; message: string; createdAt: string }
export interface AgentRun { id: string; status: "queued" | "running" | "succeeded" | "failed"; trigger: "scheduled" | "manual" | "backfill" | "test"; startedAt: string; finishedAt: string | null; statistics: Record<string, number>; events: RunEvent[] }
export interface AuditLog { id: string; adminId: string; action: string; entityType: string; entityId: string | null; before: unknown; after: unknown; createdAt: string }

export interface AdminRepository {
  listTopics(): Promise<Topic[]>;
  createTopic(input: Omit<Topic, "id">, actor: AdminActor): Promise<Topic>;
  updateTopic(id: string, input: Partial<Omit<Topic, "id">>, actor: AdminActor): Promise<Topic | null>;
  disableTopic(id: string, actor: AdminActor): Promise<Topic | null>;
  getSettings(topicId?: string): Promise<SearchSettings[]>;
  updateSettings(input: SearchSettings, actor: AdminActor): Promise<SearchSettings>;
  listChannels(): Promise<Channel[]>;
  upsertChannel(input: Omit<Channel, "id" | "isActive">, actor: AdminActor): Promise<Channel>;
  disableChannel(id: string, actor: AdminActor): Promise<Channel | null>;
  listContent(query?: string): Promise<ContentItem[]>;
  contentStatusCounts(): Promise<Record<string, number>>;
  createContent(input: Omit<ContentItem, "id" | "createdAt">, actor: AdminActor): Promise<ContentItem>;
  updateContent(id: string, input: Partial<Omit<ContentItem, "id" | "createdAt" | "sourceContentId" | "sourceUrl">>, actor: AdminActor): Promise<ContentItem | null>;
  deleteContent(id: string, actor: AdminActor): Promise<ContentItem | null>;
  listRuns(): Promise<AgentRun[]>;
  getRun(id: string): Promise<AgentRun | null>;
  triggerRun(actor: AdminActor): Promise<AgentRun>;
  listAuditLogs(): Promise<AuditLog[]>;
}
