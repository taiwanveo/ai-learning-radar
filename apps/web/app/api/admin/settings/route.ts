import { NextResponse } from "next/server";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { settingsSchema } from "@/server/admin/schemas";
export async function GET(request: Request) { try { await actor(request); const topicId = new URL(request.url).searchParams.get("topicId") ?? undefined; return NextResponse.json({ settings: await getAdminRepository().getSettings(topicId) }); } catch (e) { return invalid(e); } }
export async function PATCH(request: Request) { try { const admin = await actor(request, writableRoles); const input = settingsSchema.parse(await request.json()); return NextResponse.json({ settings: await getAdminRepository().updateSettings(input, admin) }); } catch (e) { return invalid(e); } }
