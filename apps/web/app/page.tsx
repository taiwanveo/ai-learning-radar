import { FilterBar } from "@/components/public/filter-bar";
import { VideoCard } from "@/components/public/video-card";
import { getDigest } from "@/server/public/repository";
import { digestQuerySchema } from "@/server/public/types";

type HomePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: HomePageProps) {
  const raw = await searchParams;
  const scalar = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  const normalized = {
    ...scalar,
    ...(scalar.level ? { difficulty: scalar.level } : {}),
    ...(scalar.content_type ? { contentType: scalar.content_type } : {}),
  };
  const query = digestQuerySchema.catch({ topic: "artificial-intelligence", sort: "default", difficulty: "all", recommended: "all", published: "all", contentType: "all", limit: 20 }).parse(normalized);
  const digest = await getDigest(query);
  const dateLabel = new Intl.DateTimeFormat("zh-Hant", { month: "long", day: "numeric", timeZone: "Asia/Taipei" }).format(new Date(`${digest.data.date}T12:00:00+08:00`));

  return (
    <main className="page-shell">
      <section className="today-bar" aria-labelledby="page-title">
        <div className="today-bar__title">
          <h1 id="page-title">今日精選</h1>
          <p>{digest.data.topic.name} · {dateLabel} · {digest.data.items.length} 部教學{digest.source === "demo" ? "（示範資料）" : ""}</p>
        </div>
        <span className="today-bar__live"><i aria-hidden="true" />每日更新</span>
      </section>
      <FilterBar topic={query.topic} difficulty={query.difficulty} sort={query.sort} language={query.language} published={query.published} contentType={query.contentType} />
      <section className="digest" aria-label="今日精選影片列表">
        {digest.data.items.length ? <div className="video-grid">{digest.data.items.map((video, index) => <VideoCard key={video.id} video={video} rank={index + 1} />)}</div> : <div className="empty-state"><h3>目前沒有符合條件的內容</h3><p>請調整主題、難度或語言後再試一次。</p></div>}
      </section>
    </main>
  );
}
