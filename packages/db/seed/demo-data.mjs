const lessons = [
  ["生成式 AI 入門：從模型到應用", "生成式 AI", "理解生成式模型如何把提示轉換成內容"],
  ["提示工程：寫出可重複的好提示", "Prompt Engineering", "建立包含背景、任務、限制與格式的提示"],
  ["RAG 從零實作", "RAG", "串接文件切分、向量檢索與回答生成"],
  ["AI Agent 工具呼叫實戰", "AI Agent", "設計安全且可驗證的工具呼叫流程"],
  ["Python 機器學習第一課", "Python", "使用 Python 建立第一個分類模型"],
  ["大型語言模型如何運作", "LLM", "理解 token、注意力與文字生成的基本概念"],
  ["向量資料庫選型指南", "向量資料庫", "比較常見向量索引與查詢策略"],
  ["本機部署開源模型", "本機部署", "估算硬體、選擇量化格式並啟動模型服務"],
  ["用 AI 自動整理研究資料", "AI 自動化", "建立可追蹤來源的研究整理工作流"],
  ["多模態模型入門", "多模態", "理解文字、圖片與聲音如何進入同一模型"],
  ["模型評估不能只看準確率", "模型評估", "為 AI 功能設計離線與線上評估指標"],
  ["Fine-tuning 實務決策", "Fine-tuning", "判斷何時應微調、RAG 或只改善提示"],
  ["AI 應用的資料隱私", "AI 安全", "辨識敏感資料流向與基本防護措施"],
  ["從零理解 Transformer", "Transformer", "掌握注意力機制與 Transformer 架構"],
  ["語意搜尋實作", "語意搜尋", "用 embedding 建立比關鍵字更有彈性的搜尋"],
  ["AI 產品的成本估算", "成本管理", "估算 token、推論與資料處理成本"],
  ["結構化輸出與 JSON Schema", "結構化輸出", "讓模型穩定輸出可由程式驗證的資料"],
  ["AI 工作流的錯誤處理", "可靠性", "處理逾時、重試、降級與部分失敗"],
  ["負責任 AI 基礎", "負責任 AI", "辨識偏誤、透明度與人類監督需求"],
  ["打造第一個 AI 學習專案", "專案實作", "把需求、原型、評估與部署串成完整專案"],
];

export const demoContents = lessons.map(([title, tag, focus], index) => {
  const number = index + 1;
  const beginner = index % 3 !== 1;
  return {
    fixtureId: `demo-ai-radar-${String(number).padStart(2, "0")}`,
    title: `[DEMO] ${title}`,
    tag,
    focus,
    channelTitle: `AI Learning Radar 示範頻道 ${((index % 4) + 1)}`,
    publishedAt: new Date(Date.UTC(2026, 6, Math.max(1, 21 - index), 2, 0, 0)),
    durationSeconds: 900 + index * 97,
    difficulty: beginner ? "beginner" : "normal",
    viewCount: BigInt(12_000 + index * 3_271),
    likeCount: BigInt(620 + index * 83),
    commentCount: BigInt(48 + index * 11),
    engagementScore: (0.048 + index * 0.0017).toFixed(8),
    freshEngagementScore: (0.092 - index * 0.0021).toFixed(8),
    radarScore: (0.94 - index * 0.018).toFixed(8),
    suitableFor: beginner ? "第一次接觸這個主題的學習者" : "已有基礎並準備實作的開發者",
    shortSummary: `這是明確標示的示範資料，用來預覽每日學習雷達。內容聚焦於「${focus}」，並整理成可依序練習的步驟。`,
    fullSummary: `本筆內容是 AI Learning Radar 的本機展示 fixture，不對應真實影片。示範摘要說明如何${focus}，包含核心概念、實作順序、常見問題與完成後可延伸的練習方向。`,
  };
});

export const demoQuizQuestions = [
  {
    questionText: "開始實作前，最先應確認什麼？",
    correctOptionKey: "A",
    explanation: "先確認目標與驗收方式，才能選擇合適的方法。",
    evidenceText: "先定義學習目標與可驗證的成果。",
    options: { A: "目標與驗收方式", B: "介面顏色", C: "影片播放速度", D: "社群追蹤數" },
  },
  {
    questionText: "遇到輸出不穩定時，較合理的下一步是什麼？",
    correctOptionKey: "B",
    explanation: "以固定案例評估並逐項調整，能找出真正的影響因素。",
    evidenceText: "使用測試案例記錄每次調整前後的差異。",
    options: { A: "立即重寫全部系統", B: "建立案例並逐項驗證", C: "忽略失敗", D: "只增加模型成本" },
  },
  {
    questionText: "完成基礎版本後，應如何延伸？",
    correctOptionKey: "C",
    explanation: "先量測結果再針對瓶頸迭代，能避免無依據的複雜化。",
    evidenceText: "先取得基準結果，再依瓶頸安排下一輪改善。",
    options: { A: "停止記錄", B: "同時加入所有功能", C: "量測後針對瓶頸改善", D: "移除驗證" },
  },
];

export function validateDemoData() {
  if (demoContents.length !== 20) throw new Error("Expected exactly 20 demo content items");
  if (demoQuizQuestions.length !== 3) throw new Error("Expected exactly 3 demo quiz questions");
  if (demoContents.some(({ title }) => !title.startsWith("[DEMO]"))) {
    throw new Error("Every demo title must be visibly marked as fixture data");
  }
  if (new Set(demoContents.map(({ fixtureId }) => fixtureId)).size !== demoContents.length) {
    throw new Error("Demo fixture IDs must be unique");
  }
}
