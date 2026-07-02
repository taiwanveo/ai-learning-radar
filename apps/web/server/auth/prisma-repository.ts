import { Prisma, PrismaClient } from "@prisma/client";
import type { AuthRepository } from "./repository";
import type { AdminAccount, AuditEvent, SessionRecord } from "./types";

const globalPrisma = globalThis as unknown as { aiRadarPrisma?: PrismaClient };

function client(): PrismaClient {
  globalPrisma.aiRadarPrisma ??= new PrismaClient();
  return globalPrisma.aiRadarPrisma;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient = client()) {}

  async findAdminByEmail(email: string): Promise<AdminAccount | null> {
    return this.prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findAdminById(id: string): Promise<AdminAccount | null> {
    return this.prisma.admin.findUnique({ where: { id } });
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.prisma.adminSession.create({ data: session });
  }

  async findSessionByTokenHash(sessionTokenHash: string): Promise<SessionRecord | null> {
    return this.prisma.adminSession.findUnique({ where: { sessionTokenHash } });
  }

  async deleteSessionByTokenHash(sessionTokenHash: string): Promise<void> {
    await this.prisma.adminSession.deleteMany({ where: { sessionTokenHash } });
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    await this.prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
  }

  async updateLastLogin(id: string, lastLoginAt: Date): Promise<void> {
    await this.prisma.admin.update({ where: { id }, data: { lastLoginAt } });
  }

  async writeAudit(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminId: event.adminId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        beforeJson: event.before as Prisma.InputJsonValue | undefined,
        afterJson: event.after as Prisma.InputJsonValue | undefined,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        createdAt: event.createdAt,
      },
    });
  }
}
