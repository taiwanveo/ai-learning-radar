import type { AdminAccount, AuditEvent, SessionRecord } from "./types";
import { PrismaAuthRepository } from "./prisma-repository";

export interface AuthRepository {
  findAdminByEmail(email: string): Promise<AdminAccount | null>;
  findAdminById(id: string): Promise<AdminAccount | null>;
  createSession(session: SessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  updateLastLogin(adminId: string, at: Date): Promise<void>;
  writeAudit(event: AuditEvent): Promise<void>;
}

export class MemoryAuthRepository implements AuthRepository {
  readonly audits: AuditEvent[] = [];
  private readonly admins = new Map<string, AdminAccount>();
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(admins: AdminAccount[] = []) {
    for (const admin of admins) this.admins.set(admin.id, { ...admin, email: admin.email.toLowerCase() });
  }

  async findAdminByEmail(email: string) {
    return [...this.admins.values()].find((admin) => admin.email === email.toLowerCase()) ?? null;
  }

  async findAdminById(id: string) {
    return this.admins.get(id) ?? null;
  }

  async createSession(session: SessionRecord) {
    this.sessions.set(session.sessionTokenHash, session);
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async deleteExpiredSessions(now: Date) {
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token);
    }
  }

  async updateLastLogin() {}

  async writeAudit(event: AuditEvent) {
    this.audits.push(event);
  }
}

let installedRepository: AuthRepository | undefined;

/** Install the Prisma-backed adapter during application bootstrap in production. */
export function configureAuthRepository(repository: AuthRepository): void {
  installedRepository = repository;
}

export function getAuthRepository(): AuthRepository {
  if (installedRepository) return installedRepository;
  if (process.env.DATABASE_URL) {
    installedRepository = new PrismaAuthRepository();
    return installedRepository;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AuthRepository is not configured. Install a persistent adapter before serving production traffic.");
  }
  installedRepository = new MemoryAuthRepository();
  return installedRepository;
}

export function resetAuthRepositoryForTests(): void {
  installedRepository = undefined;
}
