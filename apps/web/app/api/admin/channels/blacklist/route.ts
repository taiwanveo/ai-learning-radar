import { NextResponse } from "next/server";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { channelSchema } from "@/server/admin/schemas";
export async function POST(request: Request) { try { const admin = await actor(request, writableRoles); const input = channelSchema.parse({ ...await request.json(), listType: "blacklisted", recommendationReason: null }); return NextResponse.json({ channel: await getAdminRepository().upsertChannel(input, admin) }, { status: 201 }); } catch (e) { return invalid(e); } }
