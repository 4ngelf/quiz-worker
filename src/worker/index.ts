//! Quiz worker

//- Imports
import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";

import * as db from "./db.ts";
import * as schema from "./schema.ts";

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
