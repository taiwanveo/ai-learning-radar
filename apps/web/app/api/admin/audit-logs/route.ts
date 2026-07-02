import { NextResponse } from "next/server";
import { actor, invalid } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
export async function GET(request: Request) { try { await actor(request, ["owner", "admin"]); return NextResponse.json({ auditLogs: await getAdminRepository().listAuditLogs() }); } catch (e) { return invalid(e); } }
