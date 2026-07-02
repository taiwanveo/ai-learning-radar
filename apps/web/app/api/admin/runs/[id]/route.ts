import { NextResponse } from "next/server";
import { actor, invalid, notFound } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { await actor(request); const run = await getAdminRepository().getRun((await params).id); return run ? NextResponse.json({ run }) : notFound("執行紀錄"); } catch (e) { return invalid(e); } }
