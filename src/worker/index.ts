//! Quiz worker

//# Imports

import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import type { infer as z_infer } from "zod/mini";

import * as db from "./db.ts";
import * as schema from "./schema.ts";

//# Utilities

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

type Question = z_infer<typeof schema.Question>;
type QuesionOption = z_infer<typeof schema.QuestionOption>;

const makeQuestionsResponse = (qr: {
  questions: Record<string, Question>;
  options: Record<string, QuesionOption>;
}): Record<string, z_infer<typeof schema.Question2>> => {
  const questions: Record<string, z_infer<typeof schema.Question2>> = {};
  for (const [question_id, question] of Object.entries(qr.questions)) {
    if (question.type === schema.AnswerType.Multiple) {
      questions[question_id] = { ...question, options: [] };
    } else {
      questions[question_id] = { ...question };
    }
  }
  const sort_list: Set<string> = new Set();
  for (const option of Object.values(qr.options)) {
    const option_question_id = option.question_id.toString(10);
    const question = questions[option_question_id];
    sort_list.add(option_question_id);
    if (!question.options) {
      throw new Error(`Question ${option_question_id} does not have options`);
    }
    question.options.push(option);
  }
  for (const option_question_id of sort_list) {
    const question = questions[option_question_id];
    if (!question.options) {
      throw new Error(`Question ${option_question_id} does not have options`);
    }
    question.options.sort((a: QuesionOption, b: QuesionOption) => a.number - b.number);
  }
  return questions;
};

//# Endpoints

/// cloudflare worker API
const app = new Hono<{ Bindings: Cloudflare.Env }>()
  //
  // Check api is alive
  //
  .get("/api", (c) => c.json(SuccessResponseValue))
  //
  // Get list of questions
  //
  .get("/api/survey/:survey_id/questions", async (c) => {
    const [survey_id, parse_error] = parseId(c.req.param("survey_id"));
    if (parse_error) return c.json(parse_error, 400);

    const survey_info = await db.selectSurveyInfo(c.env, survey_id);
    if (!survey_info) {
      return c.json({ error: "Survey not found" }, 404);
    }

    return c.json({
      name: survey_info.name,
      description: survey_info.description,
      questions: makeQuestionsResponse({
        questions: await db.selectQuestions(c.env, survey_id),
        options: await db.selectQuestionOptions(c.env, survey_id),
      }),
    });
  })
  //
  // Submit Surveys
  //
  .post("/api/survey/submit", sValidator("json", schema.SubmitRequest), async (c) => {
    const submit = c.req.valid("json");

    for (const answer of submit.answers) {
      const result = schema.JsonAnswerFromString.safeParse(answer.json_answer);
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
