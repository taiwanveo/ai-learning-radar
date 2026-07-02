export const ADMIN_ROLES = ["owner", "admin", "editor", "viewer"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
}

export interface SessionRecord {
  id: string;
  adminId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionId: string;
  expiresAt: Date;
}

export interface AuditEvent {
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}
