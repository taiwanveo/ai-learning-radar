import { NextResponse } from "next/server";
import { actor, invalid, notFound, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const admin = await actor(request, writableRoles); const channel = await getAdminRepository().disableChannel((await params).id, admin); return channel ? NextResponse.json({ channel }) : notFound("頻道"); } catch (e) { return invalid(e); } }
