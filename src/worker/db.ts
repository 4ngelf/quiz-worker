//! Database and queries

import type { infer as z_infer } from "zod";

import * as schema from "./schema.ts";

// Utilities

type SqlJsonRecord = { record: string };

// In case I need to change the binding for this database
const getQuestionsDB = (env: Cloudflare.Env): D1Database => env.MAIN_DB;

// Database manipulation

export type SurveyInfo = {
  name: string;
  description: string | null;
};

const DATABASE_SELECT_SURVEY_INFO = `
SELECT name, description
FROM surveys
WHERE id = ?`;

export const selectSurveyInfo = async (
  env: Cloudflare.Env,
  survey_id: number,
): Promise<SurveyInfo | null> => {
  const db = getQuestionsDB(env);
  const result = await db
    .prepare(DATABASE_SELECT_SURVEY_INFO)
    .bind(survey_id)
    .first<SurveyInfo>();
  return result;
};

export type SelectQuestions = Record<string, z_infer<typeof schema.Question>>;

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
  const db = getQuestionsDB(env);
  const result = await db
    .prepare(DATABASE_SELECT_QUESTIONS)
    .bind(survey_id)
    .all<SqlJsonRecord>();
  return JSON.parse(result.results[0].record);
};

export type SelectQuestionOptions = Record<string, z_infer<typeof schema.QuestionOption>>;

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
  const db = getQuestionsDB(env);
  const result = await db
    .prepare(DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE)
    .bind(survey_id)
    .all<SqlJsonRecord>();
  return JSON.parse(result.results[0].record);
};

const DATABASE_INSERT_SUBMITTED = `INSERT INTO submitted (date) VALUES (?)`;

export const insertSubmitted = async (env: Cloudflare.Env, date: string): Promise<number> => {
  const db = getQuestionsDB(env);
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
  const db = getQuestionsDB(env);
  const stmt_template = db.prepare(DATABASE_INSERT_SUBMITTED_ANSWER);
  const stmts = [];
  for (const answer of answers) {
    stmts.push(stmt_template.bind(submitted_id, answer.question_id, answer.json_answer));
  }
  await db.batch(stmts);
};
