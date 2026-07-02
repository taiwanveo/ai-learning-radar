import { NextResponse } from "next/server";
import { actor, invalid, notFound, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { topicUpdateSchema } from "@/server/admin/schemas";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { try { const admin = await actor(request, writableRoles); const { id } = await context.params; const parsed = topicUpdateSchema.parse(await request.json()); const topic = await getAdminRepository().updateTopic(id, { ...parsed, keywords: parsed.keywords?.map(k => ({ ...k, id: k.id ?? crypto.randomUUID() })) }, admin); return topic ? NextResponse.json({ topic }) : notFound("主題"); } catch (e) { return invalid(e); } }
export async function DELETE(request: Request, context: Context) { try { const admin = await actor(request, writableRoles); const { id } = await context.params; const topic = await getAdminRepository().disableTopic(id, admin); return topic ? NextResponse.json({ topic }) : notFound("主題"); } catch (e) { return invalid(e); } }
