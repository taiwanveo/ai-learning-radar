import { NextResponse } from "next/server";
import { actor, invalid, notFound, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { contentUpdateSchema } from "@/server/admin/schemas";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) { try { const admin = await actor(request, writableRoles); const item = await getAdminRepository().updateContent((await params).id, contentUpdateSchema.parse(await request.json()), admin); return item ? NextResponse.json({ content: item }) : notFound("內容"); } catch (e) { return invalid(e); } }
export async function DELETE(request: Request, { params }: Context) { try { const admin = await actor(request, writableRoles); const item = await getAdminRepository().deleteContent((await params).id, admin); return item ? NextResponse.json({ content: item }) : notFound("內容"); } catch (e) { return invalid(e); } }
