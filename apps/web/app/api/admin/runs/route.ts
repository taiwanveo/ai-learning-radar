import { NextResponse } from "next/server";
import { actor, invalid } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
export async function GET(request: Request) { try { await actor(request); return NextResponse.json({ runs: await getAdminRepository().listRuns() }); } catch (e) { return invalid(e); } }
