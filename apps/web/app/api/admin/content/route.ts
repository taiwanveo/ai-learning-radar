import { NextResponse } from "next/server";
import { actor, invalid } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
export async function GET(request: Request) { try { await actor(request); const query = new URL(request.url).searchParams.get("q") ?? ""; return NextResponse.json({ content: await getAdminRepository().listContent(query) }); } catch (e) { return invalid(e); } }
