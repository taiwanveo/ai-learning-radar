import { getSession } from "./session";
import { ADMIN_ROLES, type AdminPrincipal, type AdminRole } from "./types";

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message = status === 401 ? "Authentication required" : "Insufficient permission",
  ) {
    super(message);
  }
}

type GuardOptions = { request?: Request; roles?: readonly AdminRole[] };

export async function requireAdmin(allowedRoles?: readonly AdminRole[], request?: Request): Promise<AdminPrincipal>;
export async function requireAdmin(options?: GuardOptions): Promise<AdminPrincipal>;
export async function requireAdmin(
  rolesOrOptions: readonly AdminRole[] | GuardOptions = {},
  request?: Request,
): Promise<AdminPrincipal> {
  const options = Array.isArray(rolesOrOptions)
    ? { roles: rolesOrOptions, request }
    : (rolesOrOptions as GuardOptions);
  const principal = await getSession(options.request);
  if (!principal) throw new AuthError(401);
  const roles = options.roles ?? ADMIN_ROLES;
  if (!roles.includes(principal.role)) throw new AuthError(403);
  return principal;
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
