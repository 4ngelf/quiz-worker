import { Hono } from "hono";
import * as api from "../common/api.ts";

import type { infer as z_infer } from "zod";

type QuizBindings = {
	MAIN_DB: D1Database;
};

const SuccessResponseValue = { success: true };

//- Endpoints

const app = new Hono<{ Bindings: QuizBindings }>();

app.get("/api", (c) => c.json(SuccessResponseValue));

app.get("/api/admin/start", async (c) => {
	await dbCreateTablesIfNotExists(c.env);
	return c.json(SuccessResponseValue);
});

app.get("/api/:survey_id/questions", async (c) => {
	const survey_id_str = c.req.param("survey_id");
	if (!survey_id_str) {
		return c.json({ error: "Invalid survey_id" }, 400);
	}

	const survey_id = Number(survey_id_str);
	if (isNaN(survey_id)) {
		return c.json({ error: "Invalid survey_id" }, 400);
	}

	const questions = await dbSelectQuestions(c.env, survey_id);
	const options = await dbSelectQuestionOptions(c.env, survey_id);

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

	const submitted_id = await dbInsertSubmitted(c.env, submit.date);
	await dbInsertSubmittedAnswers(c.env, submitted_id, submit.answers);

	return c.json(SuccessResponseValue);
});

//- Database schema and queries

const DATABASE_CREATE_TABLE_SURVEYS = `CREATE TABLE IF NOT EXISTS surveys (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name VARCHAR NOT NULL,
	description TEXT
)`;

const DATABASE_CREATE_TABLE_QUESTIONS = `CREATE TABLE IF NOT EXISTS questions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	survey_id INTEGER NOT NULL,
	type INTEGER NOT NULL,
	question VARCHAR NOT NULL,
	body_text TEXT,
	img_url VARCHAR,
	FOREIGN KEY (survey_id) REFERENCES surveys(id)
		ON UPDATE CASCADE ON DELETE CASCADE
)`;

const DATABASE_CREATE_TABLE_QUESTION_OPTIONS = `CREATE TABLE IF NOT EXISTS questions_options (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	question_id INTEGER NOT NULL,
	number INTEGER NOT NULL UNIQUE,
	text_value VARCHAR NOT NULL,
	img_url VARCHAR,
	FOREIGN KEY (question_id) REFERENCES questions(id)
		ON UPDATE CASCADE ON DELETE CASCADE
)`;

const DATABASE_CREATE_TABLE_SUBMITTED = `CREATE TABLE IF NOT EXISTS submitted (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date VARCHAR NOT NULL
)`;

const DATABASE_CREATE_TABLE_SUBMITTED_ANSWER = `CREATE TABLE IF NOT EXISTS submitted_answer (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	submitted_id INTEGER NOT NULL UNIQUE,
	question_id INTEGER NOT NULL,
	json_answer TEXT NOT NULL,
	FOREIGN KEY (submitted_id) REFERENCES submitted(id)
		ON UPDATE CASCADE ON DELETE CASCADE,
	FOREIGN KEY (question_id) REFERENCES questions(id)
		ON UPDATE CASCADE ON DELETE NO ACTION
)`;

const dbCreateTablesIfNotExists = async (env: QuizBindings) => {
	const db = env.MAIN_DB;
	await Promise.all([
		db.exec(DATABASE_CREATE_TABLE_SURVEYS),
		db.exec(DATABASE_CREATE_TABLE_QUESTIONS),
		db.exec(DATABASE_CREATE_TABLE_QUESTION_OPTIONS),
		db.exec(DATABASE_CREATE_TABLE_SUBMITTED),
		db.exec(DATABASE_CREATE_TABLE_SUBMITTED_ANSWER),
	]);
};

type SelectQuestionsJson = { record: string; };
type SelectQuestions = Record<string, {
	id: number;
	type: number;
	question: string;
	body_text: string | null;
	img_url: string | null;
}>;

const DATABASE_SELECT_QUESTIONS = `WITH survey_questions AS (
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

const dbSelectQuestions = async (env: QuizBindings, survey_id: number): Promise<SelectQuestions> => {
	const db = env.MAIN_DB;
	const result = await db.prepare(DATABASE_SELECT_QUESTIONS).bind(survey_id).all<SelectQuestionsJson>();
	return JSON.parse(result.results[0].record);
};

type SelectQuestionOptionsJson = { record: string; };
type SelectQuestionOptions = Record<string, {
	id: number;
	question_id: number;
	number: number;
	text_value: string;
	img_url: string | null;
}>;

const DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE = `WITH survey_questions_options AS (
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
		'question_id', question_id, 
		'number', number, 
		'text_value', text_value, 
		'img_url', img_url
	)
) AS record
FROM survey_questions_options`;

const dbSelectQuestionOptions = async (env: QuizBindings, survey_id: number): Promise<SelectQuestionOptions> => {
	const db = env.MAIN_DB;
	const result = await db.prepare(DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE).bind(survey_id).all<SelectQuestionOptionsJson>();
	return JSON.parse(result.results[0].record) as SelectQuestionOptions;
};

const DATABASE_INSERT_SUBMITTED = `INSERT INTO submitted (
	date
) VALUES (?)`;

const dbInsertSubmitted = async (env: QuizBindings, date: string): Promise<number> => {
	const db = env.MAIN_DB;
	const result = await db.prepare(DATABASE_INSERT_SUBMITTED).bind(date).run();
	return result.meta.last_row_id;
};

const DATABASE_INSERT_SUBMITTED_ANSWER = `INSERT INTO submitted_answer (
	submitted_id,
	question_id,
	json_answer
) VALUES (?, ?, ?)`;

const dbInsertSubmittedAnswers = async (env: QuizBindings, submitted_id: number, answers: z_infer<typeof api.SubmitRequest>["answers"]): Promise<void> => {
	const db = env.MAIN_DB;
	const stmt_template = db.prepare(DATABASE_INSERT_SUBMITTED_ANSWER);
	const stmts = answers.map((answer) => stmt_template.bind(submitted_id, answer.question_id, answer.json_answer));
	await db.batch(stmts);
};

//- Default export

export default app;