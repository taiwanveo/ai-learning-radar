import Link from "next/link";
import type { DigestItem } from "@/server/public/types";

type VideoCardProps = { video: DigestItem; rank?: number };

function compactNumber(value: number): string {
  return new Intl.NumberFormat("zh-Hant", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeDate(value: string | null): string {
  if (!value) return "日期未提供";
  return new Intl.DateTimeFormat("zh-Hant", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Taipei" }).format(new Date(value));
}

export function VideoCard({ video, rank = 1 }: VideoCardProps) {
  return (
    <article className="video-card">
      <a className="video-card__visual" href={video.sourceUrl} target="_blank" rel="noreferrer" aria-label={`在 YouTube 觀看：${video.title}`}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={`${video.title} 影片縮圖`} loading="lazy" /> : <span className="video-card__signal" aria-hidden="true"><i /><i /><i /><i /></span>}
        <span className="video-card__rank">#{rank.toString().padStart(2, "0")}</span>
        <span className="video-card__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 7 8 5-8 5V7Z" /></svg></span>
      </a>
      <div className="video-card__body">
        <h3><Link href={`/content/${video.id}`}>{video.title}</Link></h3>
        <div className="video-card__meta">
          {video.channelUrl ? (
            <a className="video-card__channel" href={video.channelUrl} target="_blank" rel="noreferrer">{video.channelTitle ?? "頻道未提供"}</a>
          ) : (
            <span>{video.channelTitle ?? "頻道未提供"}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{compactNumber(video.viewCount)} 次觀看</span>
          <span aria-hidden="true">·</span>
          <span>{relativeDate(video.publishedAt)}</span>
        </div>
        <div className="tag-list" aria-label="內容標籤">
          <span className="engagement" tabIndex={0} aria-label={`參與度分數 ${(video.engagementScore * 100).toFixed(1)}%，計算方式為按讚數除以觀看次數`}>
            <span className="engagement-score" aria-hidden="true">▲ {(video.engagementScore * 100).toFixed(1)}%</span>
            <span className="engagement-tip" role="tooltip" aria-hidden="true">參與度分數 = 按讚數 ÷ 觀看次數。數值越高，代表越高比例的觀眾主動按讚，互動意願越強。</span>
          </span>
          {video.isPinned ? <span className="tag tag--pinned">📌 置頂</span> : null}
          {video.difficulty === "beginner" ? <span className="tag tag--beginner">入門</span> : null}
          {video.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
        </div>
        <p className="video-card__summary">{video.shortSummary}</p>
        <div className="learning-box">
          <p><span>適合</span>{video.suitableFor}</p>
          <ul>{video.learningObjectives.slice(0, 2).map((objective) => <li key={objective}>{objective}</li>)}</ul>
        </div>
        <div className="video-card__footer">
          <span className="quiz-count">{video.quizCount > 0 ? `✦ ${video.quizCount} 題小測驗` : "測驗準備中"}</span>
          <div className="video-card__actions">
            <a className="youtube-link" href={video.sourceUrl} target="_blank" rel="noreferrer">YouTube ↗</a>
            <Link className="detail-link" href={`/content/${video.id}`}>詳情 <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </article>
  );
}
