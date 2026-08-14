//! Database and queries

import type { infer as z_infer } from "zod";

import * as schema from "./schema.ts";

export type SelectQuestionsJson = { record: string };
export type SelectQuestions = Record<string, {
  id: string;
  type: number;
  question: string;
  body_text: string | null;
  img_url: string | null;
}>;

const DATABASE_SELECT_QUESTIONS = `
WITH survey_questions AS (
  SELECT * 
  FROM questions
  WHERE survey_id = ?
)
SELECT json_group_object(
  id,
  json_object(
    'id', id,
    'type', type, 
    'question', question, 
    'body_text', body_text, 
    'img_url', img_url 
  )
) AS record
FROM survey_questions`;

export const selectQuestions = async (
  env: Cloudflare.Env,
  survey_id: number,
): Promise<SelectQuestions> => {
  const db = env.MAIN_DB;
  const result = await db
    .prepare(DATABASE_SELECT_QUESTIONS)
    .bind(survey_id)
    .all<SelectQuestionsJson>();
  return JSON.parse(result.results[0].record);
};

type SelectQuestionOptionsJson = { record: string };
type SelectQuestionOptions = Record<string, {
  id: number;
  question_id: number;
  number: number;
  text_value: string;
  img_url: string | null;
}>;

const DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE = `
WITH survey_questions_options AS (
  SELECT
    qo.id,
    qo.question_id,
    qo.number,
    qo.text_value,
    qo.img_url
  FROM questions_options qo
  INNER JOIN questions q ON qo.question_id = q.id
  WHERE q.survey_id = ?
)
SELECT json_group_object(
  id,
  json_object(
    'id', id,
    'question_id', question_id, 
    'number', number, 
    'text_value', text_value, 
    'img_url', img_url
  )
) AS record
FROM survey_questions_options`;

export const selectQuestionOptions = async (
  env: Cloudflare.Env,
  survey_id: number,
): Promise<SelectQuestionOptions> => {
  const db = env.MAIN_DB;
  const result = await db.prepare(DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE).bind(survey_id).all<
    SelectQuestionOptionsJson
  >();
  return JSON.parse(result.results[0].record) as SelectQuestionOptions;
};

const DATABASE_INSERT_SUBMITTED = `INSERT INTO submitted (date) VALUES (?)`;

export const insertSubmitted = async (env: Cloudflare.Env, date: string): Promise<number> => {
  const db = env.MAIN_DB;
  const result = await db.prepare(DATABASE_INSERT_SUBMITTED).bind(date).run();
  return result.meta.last_row_id;
};

const DATABASE_INSERT_SUBMITTED_ANSWER = `
INSERT INTO submitted_answer (
  submitted_id,
  question_id,
  json_answer
) VALUES (?, ?, ?)`;

export const insertSubmittedAnswers = async (
  env: Cloudflare.Env,
  submitted_id: number,
  answers: z_infer<typeof schema.SubmitRequest>["answers"],
): Promise<void> => {
  const db = env.MAIN_DB;
  const stmt_template = db.prepare(DATABASE_INSERT_SUBMITTED_ANSWER);
  const stmts = [];
  for (const answer of answers) {
    stmts.push(stmt_template.bind(submitted_id, answer.question_id, answer.json_answer));
  }
  await db.batch(stmts);
};
