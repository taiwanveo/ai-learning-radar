import { describe, expect, it } from "vitest";
import { scoreQuiz } from "@/components/public/quiz/quiz";
import { demoContent } from "@/server/public/demo-content";

describe("anonymous quiz", () => {
  it("scores local answers without a persistence API", () => {
    const quiz = demoContent[0].quiz!;
    const answers = Object.fromEntries(quiz.questions.map((question, index) => [question.id ?? String(index), question.correctOptionKey]));
    expect(scoreQuiz(quiz, answers)).toBe(3);
    expect(scoreQuiz(quiz, {})).toBe(0);
  });
});
