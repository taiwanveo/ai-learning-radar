type FilterBarProps = {
  topic: string;
  difficulty: string;
  sort: string;
  language?: string;
  published: string;
  contentType: string;
};

export function FilterBar({ topic, difficulty, sort, language, published, contentType }: FilterBarProps) {
  return (
    <form className="filter-bar" action="/" aria-label="內容篩選">
      <div className="filter-bar__items">
        <label className="filter-field"><span>主題</span><select name="topic" defaultValue={topic}><option value="artificial-intelligence">所有 AI 主題</option><option value="rag">RAG</option><option value="ai agent">AI Agent</option><option value="prompt">提示工程</option><option value="llm">LLM</option></select></label>
        <label className="filter-field"><span>難度</span><select name="difficulty" defaultValue={difficulty}><option value="all">所有難度</option><option value="beginner">入門</option><option value="normal">一般</option></select></label>
        <label className="filter-field"><span>語言</span><select name="language" defaultValue={language ?? ""}><option value="">所有語言</option><option value="zh-Hant">繁體中文</option><option value="zh-Hans">簡體中文</option><option value="en">英文</option></select></label>
        <label className="filter-field"><span>發布時間</span><select name="published" defaultValue={published}><option value="all">不限時間</option><option value="7d">最近 7 天</option><option value="30d">最近 30 天</option><option value="90d">最近 90 天</option></select></label>
        <label className="filter-field"><span>內容類型</span><select name="content_type" defaultValue={contentType}><option value="all">所有內容</option><option value="video">影片</option><option value="article">文章</option></select></label>
        <label className="filter-field"><span>熱門程度／排序</span><select name="sort" defaultValue={sort}><option value="default">預設推薦</option><option value="latest">最新</option><option value="popular">最熱門</option><option value="beginner">最適合入門</option><option value="engagement">參與度分數</option></select></label>
      </div>
      <button className="sort-button" type="submit">套用篩選</button>
    </form>
  );
}
