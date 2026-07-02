import { NextResponse } from "next/server";
import { actor, enforceManualRunRateLimit, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
const rateLimited = () => NextResponse.json({ error: { code: "RATE_LIMITED", message: "每位管理者每分鐘只能手動觸發一次" } }, { status: 429, headers: { "Retry-After": "60" } });
export async function POST(request: Request) { try { const admin = await actor(request, writableRoles); if (!enforceManualRunRateLimit(admin.id)) return rateLimited(); const run = await getAdminRepository().triggerRun(admin); return NextResponse.json({ run }, { status: 202 }); } catch (e) { return e instanceof Error && e.message === "RATE_LIMITED" ? rateLimited() : invalid(e); } }
