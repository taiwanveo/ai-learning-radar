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

  async listAdmins(): Promise<AdminAccount[]> {
    return this.prisma.admin.findMany({ orderBy: { createdAt: "asc" } });
  }

  async createAdmin(input: Omit<AdminAccount, "id">): Promise<AdminAccount> {
    try {
      return await this.prisma.admin.create({ data: { ...input, email: input.email.toLowerCase() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("ADMIN_EMAIL_EXISTS");
      throw error;
    }
  }

  async updateAdmin(id: string, input: Partial<Pick<AdminAccount, "name" | "role" | "isActive" | "passwordHash">>): Promise<AdminAccount | null> {
    try {
      return await this.prisma.admin.update({ where: { id }, data: input });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    }
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
