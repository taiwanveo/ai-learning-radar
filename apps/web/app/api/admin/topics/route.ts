import { NextResponse } from "next/server";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { topicCreateSchema } from "@/server/admin/schemas";

export async function GET(request: Request) { try { await actor(request); return NextResponse.json({ topics: await getAdminRepository().listTopics() }); } catch (e) { return invalid(e); } }
export async function POST(request: Request) { try { const admin = await actor(request, writableRoles); const parsed = topicCreateSchema.parse(await request.json()); return NextResponse.json({ topic: await getAdminRepository().createTopic({ ...parsed, keywords: parsed.keywords.map(k => ({ ...k, id: k.id ?? crypto.randomUUID() })) }, admin) }, { status: 201 }); } catch (e) { return invalid(e); } }
