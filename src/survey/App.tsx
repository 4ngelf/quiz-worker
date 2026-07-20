import { createSignal, For, onMount } from "solid-js";
import "./App.css";

type QuizQuestion = {
	id: number;
	prompt: string;
	correct_answer: string;
	option_a: string;
	option_b: string;
	option_c: string;
	option_d: string;
};

type SubmissionResult = {
	score: number;
	total: number;
};

function App() {
	const [questions, setQuestions] = createSignal<QuizQuestion[]>([]);
	const [answers, setAnswers] = createSignal<Record<string, string>>({});
	const [loading, setLoading] = createSignal(true);
	const [submitting, setSubmitting] = createSignal(false);
	const [message, setMessage] = createSignal<string | null>(null);
	const [result, setResult] = createSignal<SubmissionResult | null>(null);

	onMount(async () => {
		try {
			const response = await fetch("/api/questions");
			const data = (await response.json()) as { questions?: QuizQuestion[] };
			setQuestions(data.questions ?? []);
		} catch (error) {
			console.error(error);
			setMessage("Unable to load the quiz right now.");
		} finally {
			setLoading(false);
		}
	});

	const selectAnswer = (questionId: number, option: string) => {
		setAnswers((current) => ({ ...current, [questionId]: option }));
	};

	const submitQuiz = async () => {
		setSubmitting(true);
		setMessage(null);
		try {
			const payload = { answers: answers() };
			const response = await fetch("/api/submissions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = (await response.json()) as SubmissionResult & { message?: string };
			setResult({ score: data.score, total: data.total });
			setMessage(data.message ?? `You scored ${data.score} out of ${data.total}.`);
		} catch (error) {
			console.error(error);
			setMessage("Your answers could not be saved. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<main class="app-shell">
			<section class="hero-card">
				<p class="eyebrow">Solid + Hono + Cloudflare D1</p>
				<h1>Quick quiz studio</h1>
				<p class="subtitle">
					Answer the questions below and submit your responses. Your results are stored in the D1 database.
				</p>
			</section>

			{message() && (
				<p class={`status ${result() ? "success" : "warning"}`}>{message()}</p>
			)}

			{loading() ? (
				<p class="status">Loading questions…</p>
			) : (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						submitQuiz();
					}}
				>
					<For each={questions()}>
						{(question) => {
							const selected = answers()[question.id];
							return (
								<article class="question-card">
									<h2>{question.prompt}</h2>
									<div class="options-grid">
										{[question.option_a, question.option_b, question.option_c, question.option_d].map((option) => (
											<button
												type="button"
												class={`option-button ${selected === option ? "selected" : ""}`}
												onClick={() => selectAnswer(question.id, option)}
											>
												{option}
											</button>
										))}
									</div>
								</article>
							);
						}}
					</For>
					<button class="submit-button" type="submit" disabled={submitting()}>
						{submitting() ? "Submitting…" : "Submit quiz"}
					</button>
				</form>
			)}
		</main>
	);
}

export default App;
