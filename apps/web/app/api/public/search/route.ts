import { NextResponse } from "next/server";
import { searchContent } from "@/server/public/repository";
import { searchQuerySchema } from "@/server/public/types";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = searchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "查詢參數格式錯誤", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const result = await searchContent(parsed.data);
  return NextResponse.json({ q: parsed.data.q, items: result.data }, { headers: { "X-Data-Source": result.source, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
