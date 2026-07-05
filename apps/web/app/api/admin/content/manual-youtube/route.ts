import { NextResponse } from "next/server";
import { dispatchIngestWorkflow, githubDispatchConfig } from "@/server/admin/github";
import { actor, invalid, writableRoles } from "@/server/admin/http";
import { getAdminRepository } from "@/server/admin/repository";
import { manualYoutubeSchema } from "@/server/admin/schemas";

export async function POST(request: Request) {
  try {
    const admin = await actor(request, writableRoles);
    const input = manualYoutubeSchema.parse(await request.json());
    const content = await getAdminRepository().createContent({ sourceContentId: input.sourceContentId, sourceUrl: input.sourceUrl, title: input.title, channelTitle: null, shortSummary: "等待內容分析", difficulty: "normal", tags: [], status: input.publishImmediately ? "published" : "discovered", hiddenReason: null, isPinned: false, topicId: input.topicId }, admin);
    // Kick off single-video analysis on GitHub Actions so the worker fills in
    // metadata, summary and scores for this row. The row is still created when
    // dispatch is unavailable (e.g. demo mode) — analysis just stays pending.
    let analysisDispatched = false;
    if (githubDispatchConfig()) {
      try {
        await dispatchIngestWorkflow({ video_url: input.sourceUrl, ...(input.topicId ? { topic_id: input.topicId } : {}) });
        analysisDispatched = true;
      } catch (error) {
        console.error("manual-youtube analysis dispatch failed", error);
      }
    }
    return NextResponse.json({ content, analysisDispatched }, { status: 201 });
  } catch (e) {
    return invalid(e);
  }
}
