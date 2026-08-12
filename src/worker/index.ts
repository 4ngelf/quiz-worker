import { Hono } from "hono";
import * as db from "./db.ts";

import type { infer as z_infer } from "zod";

const SuccessResponseValue = { success: true };

//- Endpoints

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/api", (c) => c.json(SuccessResponseValue));

app.get("/api/:survey_id/questions", async (c) => {
  const survey_id_str = c.req.param("survey_id");
  if (!survey_id_str) {
    return c.json({ error: "Invalid survey_id" }, 400);
  }

  const survey_id = Number(survey_id_str);
  if (isNaN(survey_id)) {
    return c.json({ error: "Invalid survey_id" }, 400);
  }

  const questions = await db.selectQuestions(c.env, survey_id);
  const options = await db.selectQuestionOptions(c.env, survey_id);

  return c.json({ questions: questions, options: options });
});

app.post("/api/submit", async (c) => {
  const payload = api.SubmitRequest.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid answer payload", payload: payload.error }, 400);
  }
  const submit = payload.data;

  for (const answer of submit.answers) {
    const result = api.JsonAnswerFromString.safeParse(answer.json_answer);
    if (!result.success) {
      return c.json({ error: "Invalid answer payload", payload: payload.error }, 400);
    }
  }

  const submitted_id = await db.insertSubmitted(c.env, submit.date);
  await db.insertSubmittedAnswers(c.env, submitted_id, submit.answers);

  return c.json(SuccessResponseValue);
});

//- Default export

export default app;
