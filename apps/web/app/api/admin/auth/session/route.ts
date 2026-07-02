import { authErrorResponse, requireAdmin } from "@/server/auth/guards";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(undefined, request);
    return Response.json({ admin });
  } catch (error) {
    return authErrorResponse(error);
  }
}
