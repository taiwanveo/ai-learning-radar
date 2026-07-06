import type { AdminActor, AdminRepository, AgentRun, AuditLog, Channel, ContentItem, ScheduleStatus, SearchSettings, Topic } from "./types";
import { DEFAULT_SEARCH_SETTINGS } from "./types";
import { PrismaAdminRepository } from "./prisma-repository";

const clone = <T>(value: T): T => structuredClone(value);
const id = () => crypto.randomUUID();

export class MemoryAdminRepository implements AdminRepository {
  private topics: Topic[];
  private settings = new Map<string, SearchSettings>();
  private channels: Channel[] = [];
  private content: ContentItem[] = [];
  private runs: AgentRun[] = [];
  private audit: AuditLog[] = [];
  private schedule: ScheduleStatus = { isPaused: false, pausedAt: null, pausedByAdminId: null };

  constructor(topics: Topic[] = []) { this.topics = clone(topics); }
  private log(actor: AdminActor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) { this.audit.unshift({ id: id(), adminId: actor.id, action, entityType, entityId, before: clone(before), after: clone(after), createdAt: new Date().toISOString() }); }
  async listTopics() { return clone(this.topics); }
  async createTopic(input: Omit<Topic, "id">, actor: AdminActor) { if (this.topics.some(t => t.slug === input.slug)) throw new Error("TOPIC_SLUG_EXISTS"); const topic = { ...clone(input), id: id(), keywords: input.keywords.map(k => ({ ...k, id: k.id || id() })) }; this.topics.push(topic); this.settings.set(topic.id, clone({ ...DEFAULT_SEARCH_SETTINGS, topicId: topic.id })); this.log(actor, "create", "topic", topic.id, null, topic); return clone(topic); }
  async updateTopic(topicId: string, input: Partial<Omit<Topic, "id">>, actor: AdminActor) { const index = this.topics.findIndex(t => t.id === topicId); if (index < 0) return null; if (input.slug && this.topics.some(t => t.id !== topicId && t.slug === input.slug)) throw new Error("TOPIC_SLUG_EXISTS"); const before = clone(this.topics[index]); const next = { ...before, ...clone(input), keywords: input.keywords?.map(k => ({ ...k, id: k.id || id() })) ?? before.keywords }; this.topics[index] = next; this.log(actor, "update", "topic", topicId, before, next); return clone(next); }
  async disableTopic(topicId: string, actor: AdminActor) { return this.updateTopic(topicId, { isActive: false }, actor); }
  async getSettings(topicId?: string) { const values = [...this.settings.values()]; return clone(topicId ? values.filter(v => v.topicId === topicId) : values); }
  async updateSettings(input: SearchSettings, actor: AdminActor) { const before = this.settings.get(input.topicId) ?? null; this.settings.set(input.topicId, clone(input)); this.log(actor, "update", "topic_search_settings", input.topicId, before, input); return clone(input); }
  async listChannels() { return clone(this.channels.filter(c => c.isActive)); }
  async upsertChannel(input: Omit<Channel, "id" | "isActive">, actor: AdminActor) { const existing = this.channels.find(c => c.sourceChannelId === input.sourceChannelId); const before = existing ? clone(existing) : null; const channel: Channel = { ...clone(input), id: existing?.id ?? id(), isActive: true }; if (existing) this.channels[this.channels.indexOf(existing)] = channel; else this.channels.push(channel); this.log(actor, existing ? "update" : "create", "channel", channel.id, before, channel); return clone(channel); }
  async disableChannel(channelId: string, actor: AdminActor) { const found = this.channels.find(c => c.id === channelId); if (!found) return null; const before = clone(found); found.isActive = false; found.listType = "neutral"; this.log(actor, "disable", "channel", channelId, before, found); return clone(found); }
  async listContent(query = "") { const q = query.trim().toLowerCase(); return clone(this.content.filter(c => c.status !== "deleted" && (!q || `${c.title} ${c.channelTitle ?? ""}`.toLowerCase().includes(q)))); }
  async createContent(input: Omit<ContentItem, "id" | "createdAt">, actor: AdminActor) { if (this.content.some(c => c.sourceContentId === input.sourceContentId)) throw new Error("CONTENT_EXISTS"); const item = { ...clone(input), id: id(), createdAt: new Date().toISOString() }; this.content.unshift(item); this.log(actor, "create", "content", item.id, null, item); return clone(item); }
  async updateContent(contentId: string, input: Partial<Omit<ContentItem, "id" | "createdAt" | "sourceContentId" | "sourceUrl">>, actor: AdminActor) { const index = this.content.findIndex(c => c.id === contentId); if (index < 0) return null; const before = clone(this.content[index]); const next = { ...before, ...clone(input) }; this.content[index] = next; this.log(actor, "update", "content", contentId, before, next); return clone(next); }
  async deleteContent(contentId: string, actor: AdminActor) { return this.updateContent(contentId, { status: "deleted", hiddenReason: "管理者刪除" }, actor); }
  async contentStatusCounts() { return this.content.reduce<Record<string, number>>((acc, c) => { if (c.status !== "deleted") acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {}); }
  async listRuns() { return clone(this.runs); }
  async getRun(runId: string) { return clone(this.runs.find(r => r.id === runId) ?? null); }
  async triggerRun(actor: AdminActor) { const run: AgentRun = { id: id(), status: "queued", trigger: "manual", startedAt: new Date().toISOString(), finishedAt: null, statistics: { queued: 1 }, events: [] }; this.runs.unshift(run); this.log(actor, "trigger", "agent_run", run.id, null, run); return clone(run); }
  async listAuditLogs() { return clone(this.audit); }
  async getScheduleStatus() { return clone(this.schedule); }
  async pauseSchedule(actor: AdminActor) { const before = clone(this.schedule); this.schedule = { isPaused: true, pausedAt: new Date().toISOString(), pausedByAdminId: actor.id }; this.log(actor, "pause", "schedule_control", "singleton", before, this.schedule); return clone(this.schedule); }
  async resumeSchedule(actor: AdminActor) { const before = clone(this.schedule); this.schedule = { isPaused: false, pausedAt: null, pausedByAdminId: null }; this.log(actor, "resume", "schedule_control", "singleton", before, this.schedule); return clone(this.schedule); }
}

function defaultRepository(): AdminRepository {
  if (process.env.DATABASE_URL) return new PrismaAdminRepository();
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is required for the production admin repository");
  return new MemoryAdminRepository();
}
let repository: AdminRepository | undefined;
export const getAdminRepository = () => {
  repository ??= defaultRepository();
  return repository;
};
export const setAdminRepository = (next: AdminRepository) => { repository = next; };
export const resetAdminRepository = () => { repository = undefined; };
