import { Hono } from "hono";

type QuizBindings = {
	MAIN_DB: any;
};

const app = new Hono<{ Bindings: QuizBindings }>();

const ensureSchema = async (db: any) => {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS questions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			prompt TEXT NOT NULL,
			correct_answer TEXT NOT NULL,
			option_a TEXT NOT NULL,
			option_b TEXT NOT NULL,
			option_c TEXT NOT NULL,
			option_d TEXT NOT NULL
		)
	`).run();

	await db.prepare(`
		CREATE TABLE IF NOT EXISTS submissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			submitted_at TEXT NOT NULL,
			answers TEXT NOT NULL,
			score INTEGER NOT NULL,
			total INTEGER NOT NULL
		)
	`).run();

	const existingCount = await db.prepare("SELECT COUNT(*) AS count FROM questions").first();
	const count = (existingCount as { count?: number } | null)?.count ?? 0;

	if (count === 0) {
		await db.prepare(`
			INSERT INTO questions (prompt, correct_answer, option_a, option_b, option_c, option_d) VALUES
				('What does HTML stand for?', 'HyperText Markup Language', 'HyperText Markup Language', 'High Transfer Machine Language', 'HyperText Markdown Language', 'Home Tool Markup Language'),
				('Which CSS property changes the text color?', 'color', 'font-size', 'display', 'color', 'margin'),
				('What does API stand for?', 'Application Programming Interface', 'Application Programming Interface', 'Automated Process Integration', 'Advanced Programming Instruction', 'Automated Programming Interface')
		`).run();
	}
};

app.get("/api/", (c) => c.json({ name: "Cloudflare Quiz" }));

app.get("/api/questions", async (c) => {
	const db = c.env.MAIN_DB;
	await ensureSchema(db);
	const result = await db.prepare("SELECT id, prompt, correct_answer, option_a, option_b, option_c, option_d FROM questions ORDER BY id").all();
	return c.json({ questions: result.results });
});

app.post("/api/submissions", async (c) => {
	const db = c.env.MAIN_DB;
	await ensureSchema(db);
	const payload = await c.req.json<{ answers?: Record<string, string> }>();
	const answers = payload?.answers ?? {};

	const questionsResult = await db.prepare("SELECT id, correct_answer FROM questions ORDER BY id").all();
	const questions = questionsResult.results as Array<{ id: number; correct_answer: string }>;
	let score = 0;

	for (const question of questions) {
		const selected = answers[String(question.id)]?.trim().toLowerCase();
		const correct = question.correct_answer.trim().toLowerCase();
		if (selected === correct) {
			score += 1;
		}
	}

	await db.prepare("INSERT INTO submissions (submitted_at, answers, score, total) VALUES (?, ?, ?, ?)")
		.bind(new Date().toISOString(), JSON.stringify(answers), score, questions.length)
		.run();

	return c.json({
		score,
		total: questions.length,
		message: `You scored ${score} out of ${questions.length}.`,
	});
});

export default app;
