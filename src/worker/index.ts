import { Hono } from "hono";

type QuizBindings = {
	MAIN_DB: MainDB;
};

type MainDB = any;

//- Endpoints

const app = new Hono<{ Bindings: QuizBindings }>();

app.get("/api", (c) => c.json("API running!"));

app.get("/api-hidden/start", async (c) => {
	await dbCreateTablesIfNotExists(c.env.MAIN_DB);
});

app.get("/api/questions", async (c) => {
	const db = c.env.MAIN_DB;
	const questions = await dbSelectQuestions(db);
	const options = await dbSelectQuestionOptions(db);

	return c.json({ questions: questions, options: options });
});

app.post("/api/submit", async (c) => {
	const db = c.env.MAIN_DB;

	const payload = await c.req.json<SubmitAnswer>();
	if (!validateSubmitAnswer(payload)) {
		return c.json({ error: "Invalid submit answer" }, 400);
	}

	const date = payload.date as string;
	const answers = payload.answers as Answer[];

	for (const answer of answers) {
		if (!validateAnswerJson(JSON.parse(answer.answer_in_json as string))) {
			return c.json({ error: "Invalid answer format" }, 400);
		}
	}

	const submitted_id = await dbInsertSubmitted(db, date);

	for (const answer of answers) {
		const question_id = answer.question_id as number;
		const answer_json = answer.answer_in_json as string;
		await dbInsertSubmittedAnswer(db, submitted_id, question_id, answer_json);
	}
	
	return c.json({success: true});
});

//- Database schema and queries

const DATABASE_CREATE_TABLE_QUESTIONS = `CREATE TABLE IF NOT EXISTS questions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	type INTEGER NOT NULL,
	question VARCHAR NOT NULL,
	body_text TEXT,
	img_url VARCHAR
)`;

const DATABASE_CREATE_TABLE_QUESTION_OPTION_MULTIPLE = `CREATE TABLE IF NOT EXISTS questions_option_multiple (
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

const dbCreateTablesIfNotExists = async (db: MainDB) => {
	await Promise.all([
		db.prepare(DATABASE_CREATE_TABLE_QUESTIONS).run(),
		db.prepare(DATABASE_CREATE_TABLE_QUESTION_OPTION_MULTIPLE).run(),
		db.prepare(DATABASE_CREATE_TABLE_SUBMITTED).run(),
		db.prepare(DATABASE_CREATE_TABLE_SUBMITTED_ANSWER).run(),
	]);
};

type SelectQuestions = {
	id: number;
	type: number;
	question: string;
	body_text: string | null;
	img_url: string | null;
};

const DATABASE_SELECT_QUESTIONS = `SELECT
	id,
	type,
	question,
	body_text,
	img_url
FROM questions`;

const dbSelectQuestions = async (db: MainDB): Promise<SelectQuestions[]> => {
	const result = await db.prepare(DATABASE_SELECT_QUESTIONS).all();
	return result.results as SelectQuestions[];
};

type SelectQuestionOptions = {
	question_id: number;
	number: number;
	text_value: string;
	img_url: string | null;
};

const DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE = `SELECT
	question_id,
	number,
	text_value,
	img_url
FROM questions_option_multiple`;

const dbSelectQuestionOptions = async (db: MainDB): Promise<SelectQuestionOptions[]> => {
	const result = await db.prepare(DATABASE_SELECT_QUESTION_OPTIONS_MULTIPLE).all();
	return result.results as SelectQuestionOptions[];
};

const DATABASE_INSERT_SUBMITTED = `INSERT INTO submitted (date) VALUES (?)`;

const dbInsertSubmitted = async (db: MainDB, date: string): Promise<number> => {
	const result = await db.prepare(DATABASE_INSERT_SUBMITTED).run(date);
	return result.lastInsertRowid as number;
};

const DATABASE_INSERT_SUBMITTED_ANSWER = `INSERT INTO submitted_answer (submitted_id, question_id, json_answer) VALUES (?, ?, ?)`;

const dbInsertSubmittedAnswer = async (db: MainDB, submitted_id: number, question_id: number, json_answer: string): Promise<void> => {
	await db.prepare(DATABASE_INSERT_SUBMITTED_ANSWER).run(submitted_id, question_id, json_answer);
};

//- Data processing

type SubmitAnswer = {
	date?: string;
	answers?: Answer[];
};

type Answer = {
	question_id?: number;
	answer_in_json?: string;
};

type AnswerJson = {
	type?: AnswerType;
	value?: AnswerForText | AnswerForMultiple;
};

enum AnswerType {
	Text,
	MultipleChoice,
}

type AnswerForText = {
	large?: boolean;
	text?: string;
};

type AnswerForMultiple = {
	question_option_multiple_id?: number;
};

const validateSubmitAnswer = (answer_or_any: any): boolean => {
	if (!answer_or_any || typeof answer_or_any !== "object") {
		return false;
	}
	const answer = answer_or_any as SubmitAnswer;
	if (typeof answer.date !== "string") {
		return false;
	}
	if (!answer.answers || !Array.isArray(answer.answers)) {
		return false;
	}
	for (const ans of answer.answers) {
		if (!ans.question_id || typeof ans.question_id !== "number") {
			return false;
		}
		if (!ans.answer_in_json || typeof ans.answer_in_json !== "string") {
			return false;
		}
	}
	return true;
};

const validateAnswerJson = (answer_json_or_any: any): boolean => {
	if (!answer_json_or_any || typeof answer_json_or_any !== "object") {
		return false;
	}
	const answer = answer_json_or_any as AnswerJson;
	if (typeof answer.type !== "number") {
		return false;
	}
	switch (answer.type) {
		case AnswerType.Text:
			const textAnswer = answer.value as AnswerForText;
			return typeof textAnswer.text === "string";
		case AnswerType.MultipleChoice:
			const multipleAnswer = answer.value as AnswerForMultiple;
			return typeof multipleAnswer.question_option_multiple_id === "number" && multipleAnswer.question_option_multiple_id > 0;
		default:
			return false;
	}
};

//- Default export

export default app;