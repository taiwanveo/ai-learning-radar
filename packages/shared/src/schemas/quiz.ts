import { z } from "zod";

export const quizOptionKeySchema = z.enum(["A", "B", "C", "D"]);
export const quizQuestionTypeSchema = z.enum(["comprehension", "application", "concept"]);

export const quizOptionsSchema = z.object({
  A: z.string().trim().min(1),
  B: z.string().trim().min(1),
  C: z.string().trim().min(1),
  D: z.string().trim().min(1),
});

export const quizQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  questionType: quizQuestionTypeSchema,
  questionText: z.string().trim().min(1),
  options: quizOptionsSchema,
  correctOptionKey: quizOptionKeySchema,
  explanation: z.string().trim().min(1),
  evidenceText: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const quizSchema = z.object({
  id: z.string().uuid().optional(),
  questions: z.array(quizQuestionSchema).length(3).superRefine((questions, context) => {
    const actual = new Set(questions.map((question) => question.questionType));
    for (const required of quizQuestionTypeSchema.options) {
      if (!actual.has(required)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `缺少 ${required} 題型`,
        });
      }
    }
  }),
});

export type Quiz = z.infer<typeof quizSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
