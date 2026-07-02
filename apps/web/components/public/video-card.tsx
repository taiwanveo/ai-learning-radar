import Link from "next/link";
import type { DigestItem } from "@/server/public/types";

type VideoCardProps = { video: DigestItem; rank?: number };

const accents = ["mint", "violet", "amber", "blue"] as const;

function compactNumber(value: number): string {
  return new Intl.NumberFormat("zh-Hant", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function relativeDate(value: string | null): string {
  if (!value) return "發布日期未提供";
  return new Intl.DateTimeFormat("zh-Hant", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Taipei" }).format(new Date(value));
}

export function VideoCard({ video, rank = 1 }: VideoCardProps) {
  const accent = accents[(rank - 1) % accents.length];
  return (
    <article className="video-card">
      <Link className={`video-card__visual video-card__visual--${accent}`} href={`/content/${video.id}`}>
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt={`${video.title} 影片縮圖`} loading="lazy" /> : <span className="video-card__signal" aria-hidden="true"><i /><i /><i /><i /></span>}
        <span className="video-card__rank">#{rank.toString().padStart(2, "0")}</span>
        <span className="video-card__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 7 8 5-8 5V7Z" /></svg></span>
      </Link>
      <div className="video-card__body">
        <div className="video-card__meta"><span>{video.channelTitle ?? "頻道未提供"}</span><span aria-hidden="true">·</span><span>{relativeDate(video.publishedAt)}</span></div>
        <h3><Link href={`/content/${video.id}`}>{video.title}</Link></h3>
        <div className="video-card__stats" aria-label={`觀看 ${video.viewCount}，按讚 ${video.likeCount}，參與度分數 ${video.engagementScore}`}>
          <span>{compactNumber(video.viewCount)} 次觀看</span>
          <span className="engagement-score">參與度分數 {(video.engagementScore * 100).toFixed(1)}%</span>
        </div>
        <div className="tag-list" aria-label="內容標籤">
          {video.difficulty === "beginner" ? <span className="tag tag--beginner">入門</span> : null}
          {video.tags.length ? video.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>) : <span className="tag">待分類</span>}
        </div>
        <p className="video-card__summary">{video.shortSummary}</p>
        <div className="learning-box">
          <p><span>適合</span> {video.suitableFor}</p>
          <ul>{video.learningObjectives.slice(0, 2).map((objective) => <li key={objective}>{objective}</li>)}</ul>
        </div>
        <div className="video-card__footer">
          <span className="quiz-count">{video.quizCount > 0 ? `${video.quizCount} 題小測驗` : "測驗準備中"}</span>
          <div className="video-card__actions">
            <a className="youtube-link" href={video.sourceUrl} target="_blank" rel="noreferrer">YouTube ↗</a>
            <Link className="detail-link" href={`/content/${video.id}`}>查看詳情 <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </article>
  );
}
