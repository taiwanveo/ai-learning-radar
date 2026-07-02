import { NextResponse } from "next/server";
import { buildLearningPath } from "@/server/public/learning-path";
import { searchContent } from "@/server/public/repository";
import { learningPathRequestSchema } from "@/server/public/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供合法 JSON" }, { status: 400 });
  }
  const parsed = learningPathRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "請求格式錯誤", issues: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { query, difficulty, contentItemIds } = parsed.data;
  const search = await searchContent({ q: query, difficulty, limit: 25 });
  const allowedIds = new Set(contentItemIds);
  const candidates = search.data.filter((item) => allowedIds.has(item.id));
  if (candidates.length < 3) return NextResponse.json({ error: "至少需要 3 筆有效搜尋結果才能產生學習指引" }, { status: 422 });

  return NextResponse.json(buildLearningPath(query, candidates), { headers: { "Cache-Control": "no-store", "X-Data-Source": search.source } });
}
