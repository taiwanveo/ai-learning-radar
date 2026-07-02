import { NextResponse } from "next/server";
import { getDigest } from "@/server/public/repository";
import { digestQuerySchema } from "@/server/public/types";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = digestQuerySchema.safeParse({
    ...params,
    ...(params.level ? { difficulty: params.level } : {}),
    ...(params.content_type ? { contentType: params.content_type } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "查詢參數格式錯誤", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const result = await getDigest(parsed.data);
  return NextResponse.json(result.data, { headers: { "X-Data-Source": result.source, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
