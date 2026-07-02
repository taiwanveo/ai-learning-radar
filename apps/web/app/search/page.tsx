import { LearningPathButton } from "@/components/public/learning-path-button";
import { VideoCard } from "@/components/public/video-card";
import { searchContent } from "@/server/public/repository";
import { searchQuerySchema } from "@/server/public/types";

type SearchPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const query = searchQuerySchema.parse({ q: typeof raw.q === "string" ? raw.q : "", difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "all" });
  const result = await searchContent(query);
  return (
    <main className="page-shell search-page">
      <header className="search-hero"><p className="eyebrow">SEARCH THE RADAR</p><h1>搜尋 AI 學習內容</h1><form action="/search" className="search-form"><label><span className="sr-only">搜尋關鍵字</span><input type="search" name="q" defaultValue={query.q} placeholder="輸入主題，例如 RAG、AI Agent" autoFocus /></label><select name="difficulty" defaultValue={query.difficulty} aria-label="難度"><option value="all">所有難度</option><option value="beginner">入門</option><option value="normal">一般</option></select><button className="primary-button" type="submit">搜尋</button></form><p>搜尋標題、頻道、摘要、標籤、學習目標與 Transcript 摘要。</p></header>
      {query.q ? <section className="digest" aria-labelledby="results-title"><div className="section-heading"><div><p className="section-heading__kicker">SEARCH RESULTS</p><h2 id="results-title">「{query.q}」找到 {result.data.length} 筆</h2></div><p>{result.source === "demo" ? "目前顯示示範資料" : "依發布時間排序"}</p></div>{result.data.length ? <div className="video-grid">{result.data.map((item, index) => <VideoCard key={item.id} video={item} rank={index + 1} />)}</div> : <div className="empty-state"><h3>沒有符合的內容</h3><p>請改用更短或不同的關鍵字。</p></div>}{result.data.length >= 3 ? <LearningPathButton query={query.q} difficulty={query.difficulty} results={result.data.map(({ id, title }) => ({ id, title }))} /> : null}</section> : <section className="empty-state search-empty"><h2>從一個想學的主題開始</h2><p>搜尋結果至少 3 筆時，可以按鈕產生只基於這些結果的學習順序建議。</p></section>}
    </main>
  );
}
