import { NextResponse } from "next/server";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { manualYoutubeSchema } from "@/server/admin/schemas";
export async function POST(request: Request) { try { const admin = await actor(request, writableRoles); const input = manualYoutubeSchema.parse(await request.json()); const content = await getAdminRepository().createContent({ sourceContentId: input.sourceContentId, sourceUrl: input.sourceUrl, title: input.title, channelTitle: null, shortSummary: "等待內容分析", difficulty: "normal", tags: [], status: input.publishImmediately ? "published" : "discovered", hiddenReason: null, isPinned: false, topicId: input.topicId }, admin); return NextResponse.json({ content }, { status: 201 }); } catch (e) { return invalid(e); } }
