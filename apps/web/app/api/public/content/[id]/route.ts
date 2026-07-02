import { NextResponse } from "next/server";
import { getContentDetail } from "@/server/public/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getContentDetail(id);
  if (!result) return NextResponse.json({ error: "內容不存在" }, { status: 404 });
  return NextResponse.json(result.data, { headers: { "X-Data-Source": result.source, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
