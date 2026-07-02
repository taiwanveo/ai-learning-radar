"use client";

import { useState } from "react";
import type { Quiz as QuizData } from "@/lib/schemas";

type Answers = Record<string, string>;

export function scoreQuiz(quiz: QuizData, answers: Answers): number {
  return quiz.questions.reduce((score, question, index) => score + (answers[question.id ?? String(index)] === question.correctOptionKey ? 1 : 0), 0);
}

export function Quiz({ quiz }: { quiz: QuizData }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [submitted, setSubmitted] = useState(false);
  const complete = quiz.questions.every((question, index) => answers[question.id ?? String(index)]);
  const score = submitted ? scoreQuiz(quiz, answers) : 0;

  return (
    <section className="quiz-panel" aria-labelledby="quiz-title">
      <div className="detail-section__heading"><p className="section-heading__kicker">QUICK CHECK</p><h2 id="quiz-title">3 題匿名小測驗</h2><p>答案只保留在這個頁面的瀏覽器狀態，不會傳送或儲存。</p></div>
      {quiz.questions.map((question, index) => {
        const key = question.id ?? String(index);
        return (
          <fieldset className="quiz-question" key={key} disabled={submitted}>
            <legend><span>{index + 1}</span>{question.questionText}</legend>
            <div className="quiz-options">{Object.entries(question.options).map(([optionKey, text]) => {
              const selected = answers[key] === optionKey;
              const correct = submitted && optionKey === question.correctOptionKey;
              const wrong = submitted && selected && !correct;
              return <label className={`quiz-option${correct ? " quiz-option--correct" : ""}${wrong ? " quiz-option--wrong" : ""}`} key={optionKey}><input type="radio" name={key} value={optionKey} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [key]: optionKey }))} /><strong>{optionKey}</strong><span>{text}</span></label>;
            })}</div>
            {submitted ? <div className="quiz-explanation" role="status"><strong>{answers[key] === question.correctOptionKey ? "答對了" : `正確答案是 ${question.correctOptionKey}`}</strong><p>{question.explanation}</p><small>影片依據：{question.evidenceText}</small></div> : null}
          </fieldset>
        );
      })}
      {submitted ? <div className="quiz-result"><strong>答對 {score} / {quiz.questions.length} 題</strong><button type="button" onClick={() => { setAnswers({}); setSubmitted(false); }}>重新作答</button></div> : <button className="primary-button" type="button" disabled={!complete} onClick={() => setSubmitted(true)}>送出答案</button>}
    </section>
  );
}
