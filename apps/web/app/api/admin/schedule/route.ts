import { NextResponse } from "next/server";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";

export async function GET(request: Request) {
  try {
    await actor(request);
    return NextResponse.json({ schedule: await getAdminRepository().getScheduleStatus() });
  } catch (e) {
    return invalid(e);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await actor(request, writableRoles);
    const body = await request.json().catch(() => null);
    const action = body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;
    if (action !== "pause" && action !== "resume") return invalid(new Error("action 必須是 pause 或 resume"));
    const repository = getAdminRepository();
    const schedule = action === "pause" ? await repository.pauseSchedule(admin) : await repository.resumeSchedule(admin);
    return NextResponse.json({ schedule });
  } catch (e) {
    return invalid(e);
  }
}
