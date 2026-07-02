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
  const dateLabel = new Intl.DateTimeFormat("zh-Hant", { dateStyle: "long", timeZone: "Asia/Taipei" }).format(new Date(`${digest.data.date}T12:00:00+08:00`));

  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero__copy"><p className="eyebrow">今日學習雷達 · {dateLabel}</p><h1 id="page-title">少一點追逐，<span>多一點真正學會。</span></h1><p className="hero__description">每天從中文 AI 教學中，找出值得你投入時間的內容。摘要、重點和學習目標都先整理好了。</p></div>
        <aside className="daily-brief" aria-label="今日精選摘要"><span className="daily-brief__pulse" aria-hidden="true" /><div><strong>{digest.data.topic.name}精選已更新</strong><p>目前有 {digest.data.items.length} 部符合篩選條件的教學內容{digest.source === "demo" ? "（示範資料）" : ""}</p></div></aside>
      </section>
      <FilterBar topic={query.topic} difficulty={query.difficulty} sort={query.sort} language={query.language} published={query.published} contentType={query.contentType} />
      <section className="digest" aria-labelledby="digest-title">
        <div className="section-heading"><div><p className="section-heading__kicker">DAILY TOP PICKS</p><h2 id="digest-title">今天，從這裡開始</h2></div><p>依目前篩選與排序顯示</p></div>
        {digest.data.items.length ? <div className="video-grid">{digest.data.items.map((video, index) => <VideoCard key={video.id} video={video} rank={index + 1} />)}</div> : <div className="empty-state"><h3>目前沒有符合條件的內容</h3><p>請調整主題、難度或語言後再試一次。</p></div>}
      </section>
    </main>
  );
}
