import Link from "next/link";
import { notFound } from "next/navigation";
import { Quiz } from "@/components/public/quiz/quiz";
import { getContentDetail } from "@/server/public/repository";

type DetailPageProps = { params: Promise<{ id: string }> };

export default async function DetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const result = await getContentDetail(id);
  if (!result) notFound();
  const item = result.data;
  return (
    <main className="page-shell detail-page">
      <Link className="back-link" href="/">← 返回今日精選</Link>
      <article>
        <header className="detail-hero">
          <div><p className="eyebrow">{item.topicNames.join(" · ") || "AI 教學"}{result.source === "demo" ? " · 示範資料" : ""}</p><h1>{item.title}</h1><p className="detail-hero__summary">{item.shortSummary}</p><div className="tag-list">{item.difficulty === "beginner" ? <span className="tag tag--beginner">入門</span> : null}{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>
          <aside className="detail-facts">{item.thumbnailUrl ? <img className="detail-facts__thumbnail" src={item.thumbnailUrl} alt={`${item.title} 影片縮圖`} /> : null}<dl><div><dt>頻道</dt><dd>{item.channelTitle ?? "未提供"}</dd></div><div><dt>發布日期</dt><dd>{item.publishedAt ? new Intl.DateTimeFormat("zh-Hant", { dateStyle: "long", timeZone: "Asia/Taipei" }).format(new Date(item.publishedAt)) : "未提供"}</dd></div><div className="fact-with-tip" tabIndex={0} aria-describedby="engagement-tip"><dt>參與度分數 <span className="fact-tip__marker" aria-hidden="true">ⓘ</span></dt><dd>{(item.engagementScore * 100).toFixed(1)}%</dd><span className="fact-tip" role="tooltip" id="engagement-tip">參與度分數 = 按讚數 ÷ 觀看次數，以百分比呈現。數值越高，代表越高比例的觀眾主動按讚，互動意願越強。</span></div><div><dt>觀看次數</dt><dd>{item.viewCount.toLocaleString("zh-Hant")}</dd></div><div><dt>按讚數</dt><dd>{item.likeCount.toLocaleString("zh-Hant")}</dd></div><div><dt>留言數</dt><dd>{item.commentCount.toLocaleString("zh-Hant")}</dd></div><div><dt>適合誰</dt><dd>{item.suitableFor}</dd></div></dl><a className="primary-button" href={item.sourceUrl} target="_blank" rel="noreferrer">前往 YouTube ↗</a></aside>
        </header>
        <div className="detail-layout">
          <div className="detail-copy"><section><h2>完整摘要</h2><p>{item.fullSummary}</p></section><section><h2>學習目標</h2><ol>{item.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}</ol></section>{item.transcriptSummary ? <section><h2>Transcript 摘要</h2><p>{item.transcriptSummary}</p></section> : null}{item.limitationsOrCautions ? <section className="caution-box"><h2>限制與注意事項</h2><p>{item.limitationsOrCautions}</p></section> : null}</div>
        </div>
      </article>
      {item.quiz ? <Quiz quiz={item.quiz} /> : <section className="empty-state"><h2>測驗功能規劃中</h2><p>目前版本先提供影片分類、排名與摘要；測驗將在後續階段推出。</p></section>}
    </main>
  );
}
