//! Quiz worker

//- Imports
import { Hono, validator } from "hono";
import { sValidator } from "@hono/standard-validator";
import * as db from "./db.ts";

import {
  array,
  boolean,
  literal,
  nullable,
  number,
  object,
  pipe,
  positive,
  record,
  string,
  transform,
  xor,
} from "zod/mini";
import type { infer as z_infer } from "zod/mini";

//- Schemas

// Common types

export const Index = number().check(positive());

export const StringIndex = string().check((ctx) => {
  const index = Number(ctx.value);
  if (isNaN(index) || index < 0) {
    ctx.issues.push({
      code: "too_small",
      minimum: 0,
      origin: "string",
      inclusive: true,
      message: "Index cannot be smaller than zero",
      input: ctx.value,
    });
  }
});

export const SuccessResponse = object({
  success: boolean(),
});

//- GET /api
//  Response = SuccessResponse

//- GET /api/admin/start
//  Response = SuccessResponse

//- GET /api/${survey_id}/questions
//  Response = QuestionsResponse

export const Question = object({
  id: Index,
  type: number(),
  question: string(),
  body_text: nullable(string()),
  img_url: nullable(string()),
});

export const QuestionOption = object({
  id: Index,
  question_id: Index,
  number: Index,
  text_value: string(),
  img_url: nullable(string()),
});

export const QuestionsResponse = object({
  questions: record(StringIndex, Question),
  options: record(StringIndex, QuestionOption),
});

//- POST /api/submit
//  Request = SubmitRequest
//  Response = SuccessResponse

export enum AnswerType {
  Text = 0,
  Multiple = 1,
}

export const JsonAnswerForText = object({
  type: literal(AnswerType.Text),
  large: boolean(),
  text: string(),
});

export const JsonAnswerForMultiple = object({
  type: literal(AnswerType.Multiple),
  question_option_id: Index,
});

export const JsonAnswer = xor([
  JsonAnswerForText,
  JsonAnswerForMultiple,
]);

export const JsonAnswerFromString = pipe(
  pipe(string(), transform((s) => JSON.parse(s))),
  JsonAnswer,
);

export const SubmitRequest = object({
  date: string(),
  answers: array(object({
    question_id: Index,
    json_answer: string(),
  })),
});

//- Endpoints

type Result<Ok, Error> = [Ok, undefined] | [undefined, Error];

const parseId = (s: string): Result<number, { error: string }> => {
  if (!s) {
    return [undefined, { error: "Expected a survey id" }];
  }
  const num = Number(s);
  if (isNaN(num) || num < 0) {
    return [undefined, { error: "Invalid survey id. Must be greater than zero" }];
  }
  return [num, undefined];
};

const SuccessResponseValue = { success: true };

/// cloudflare worker API
const app = new Hono<{ Bindings: Cloudflare.Env }>()
  //
  // Check api is alive
  //
  .get<"/api">("/api", (c) => c.json(SuccessResponseValue))
  //
  // Get list of questions
  //
  .get<"/api/survey/:survey_id/questions">("/api/survey/:survey_id/questions", async (c) => {
    const [survey_id, parse_error] = parseId(c.req.param("survey_id"));
    if (parse_error) return c.json(parse_error, 400);

    return c.json({
      questions: await db.selectQuestions(c.env, survey_id),
      options: await db.selectQuestionOptions(c.env, survey_id),
    });
  })
  //
  // Submit Surveys
  //
  .post("/api/survey/submit", sValidator("json", SubmitRequest), async (c) => {
    const submit = c.req.valid("json");

    for (const answer of submit.answers) {
      const result = JsonAnswerFromString.safeParse(answer.json_answer);
      if (!result.success) {
        return c.json({ error: "Invalid answer payload", payload: result.error }, 400);
      }
    }

    const new_submitted_id = await db.insertSubmitted(c.env, submit.date);
    await db.insertSubmittedAnswers(c.env, new_submitted_id, submit.answers);

    return c.json(SuccessResponseValue);
  });

//- Default export

export type API = typeof app;
export default app;
