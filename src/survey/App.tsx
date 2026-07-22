//# Imports

import {
	createSignal,
	createEffect,
	createResource,
	onMount,
	For,
	Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import * as validate from "./validate";

//# Assets

import "./App.css";

//# API Layer

const apiFetch = async (url: string, validate_response_fn: (response: any) => boolean, fetch_opts?: RequestInit): Promise<any> => {
	const response = await fetch(url, fetch_opts);
	if (!response.ok) {
		throw new Error(`Failed to fetch data from '${url}' with ${response.status} '${response.statusText}'`);
	}
	const data = await response.json();
	if (!validate_response_fn(data)) {
		throw new Error(`Validation failed for response received from '${url}'`);
	}
	return data;
};

const apiFetchPostJson = async (url: string, validate_response_fn: (response: any) => boolean, json_object: any): Promise<any> =>
	apiFetch(url, validate_response_fn, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(json_object),
	});

const isValidResponseSuccess = (response: any): response is {success: boolean} => {
	if (!validate.isObject(response)) {
		return false;
	}
	if (!validate.hasAttribute(response, "success")) {
		return false;
	}
	if (!validate.isBoolean((response as {success: boolean}).success)) {
		return false;
	}
	return true;
};

//## /api/admin/start

type ResponseStart = {
	success: boolean;
};

const fetchStart = (): Promise<ResponseStart> => apiFetch("/api/admin/start", isValidResponseStart);

const isValidResponseStart: (response: any) => response is ResponseStart = isValidResponseSuccess;

//## /api/{survey_id}/questions

type ResponseQuestions = {
	questions: QuizQuestion[];
	options: QuizQuestionOptions[];
};

type QuizQuestion = {
	id: number;
	type: number;
	question: string;
	body_text?: string;
	img_url?: string;
};

type QuizQuestionOptions = {
	question_id: number;
	number: number;
	text_value: string;
	img_url?: string;
};

const fetchQuestions = (survey_id: number): Promise<ResponseQuestions> => 
	apiFetch(`/api/${survey_id}/questions`, isValidResponseQuestions);

const isValidResponseQuestions = (response: any): response is ResponseQuestions => {
	if (!validate.isObject(response)) {
		return false;
	}
	if (!validate.hasAttributes(response, ["questions", "options"])) {
		return false;
	}
	if (!validate.isArrayWith((response as ResponseQuestions).questions, isValidQuizQuestion)) {
		return false;
	}
	if (!validate.isArrayWith((response as ResponseQuestions).options, isValidQuizQuestionOptions)) {
		return false;
	}
	return true;
};

const isValidQuizQuestion = (question: any): question is QuizQuestion => {
	if (!validate.isObject(question)) {
		return false;
	}
	if (!validate.hasAttributes(question, ["id", "type", "question"])) {
		return false;
	}
	if (!validate.isNumber((question as QuizQuestion).id)) {
		return false;
	}
	if (!validate.isNumber((question as QuizQuestion).type)) {
		return false;
	}
	if (!validate.isString((question as QuizQuestion).question)) {
		return false;
	}
	if (validate.hasAttribute(question, "body_text")) {
		if (!validate.isString((question as QuizQuestion).body_text)) {
			return false;
		}
	}
	if (validate.hasAttribute(question, "img_url")) {
		if (!validate.isString((question as QuizQuestion).img_url)) {
			return false;
		}
	}
	return true;
};

const isValidQuizQuestionOptions = (option: any): option is QuizQuestionOptions => {
	if (!validate.isObject(option)) {
		return false;
	}
	if (!validate.hasAttributes(option, ["question_id", "number", "text_value"])) {
		return false;
	}
	if (!validate.isNumber((option as QuizQuestionOptions).question_id)) {
		return false;
	}
	if (!validate.isNumber((option as QuizQuestionOptions).number)) {
		return false;
	}
	if (!validate.isString((option as QuizQuestionOptions).text_value)) {
		return false;
	}
	if (validate.hasAttribute(option, "img_url")) {
		if (!validate.isString((option as QuizQuestionOptions).img_url)) {
			return false;
		}
	}
	return true;
};

//## /api/submit

type RequestSubmit = {
	date: string;
	answers: QuizAnswer[];
};

type ResponseSubmit = {
	success: boolean;
};

type QuizAnswer = {
	question_id: number;
	answer_in_json: string;
};

type QuizAnswerJsonObject = {
	type: AnswerType;
	value: AnswerFor;
};

enum AnswerType {
	Text = 0,
	MultipleChoice = 1,
};

type AnswerFor = AnswerForText | AnswerForMultiple;

type AnswerForText = {
	// Whether the text answer is large (multi-line) or not.
	large: boolean;
	text: string;
};

type AnswerForMultiple = {
    question_option_multiple_id: number;
};

const fetchSubmit = (answers: QuizAnswer[]): Promise<ResponseSubmit> => 
	apiFetchPostJson("/api/submit", isValidResponseSubmit, makeRequestSubmit(answers));

const isValidResponseSubmit: (response: any) => response is ResponseSubmit = isValidResponseSuccess;

const makeRequestSubmit = (answers: QuizAnswer[]): RequestSubmit => {
	return {
		date: new Date().toISOString(),
		answers,
	};
};

const makeQuizAnswerForText = (question_id: number, text: string, large: boolean): QuizAnswer => {
	return {
		question_id: question_id,
		answer_in_json: JSON.stringify({
			type: AnswerType.Text,
			value: {
				large: large,
				text: text
			}
		}),
	};
};

const makeQuizAnswerForMultiple = (question_id: number, question_option_multiple_id: number): QuizAnswer => {
	return {
		question_id: question_id,
		answer_in_json: JSON.stringify({
			type: AnswerType.MultipleChoice,
			value: {
				question_option_multiple_id: question_option_multiple_id
			}
		}),
	};
};

//# Frontend Components

//## State manipulation

type QuestionIndex = number;
type OptionIndex = number;

type AppAllQuestionsState = Record<QuestionIndex, AppQuestionState>

// Internal representation for questions
type AppQuestionState = {
	answer: AnswerFor;
	options_if_multiple?: OptionIndex[];
};

// Assumes that response.options is ordered by question_id
const makeStateFromResponseQuestions = (response: ResponseQuestions): AppAllQuestionsState => {
	const ret: AppAllQuestionsState = {};
	
	for (const question of response.questions) {
		let state: AppQuestionState;
		switch (question.type) {
			case AnswerType.Text:
				state = {
					answer: { large: false, text: "" } as AnswerForText,
				};
				break;
			case AnswerType.MultipleChoice:	
				state = {
					answer: { question_option_multiple_id: -1 } as AnswerForMultiple,
					options_if_multiple: [],
				};
				break;
			default:
				throw new Error(`Unknown type '${question.type}' from question 'id: ${question.id}'`);
		}
		ret[question.id] = state;
	}

	let sort_list: QuestionIndex[] = [];
	for (let option_index = 0; option_index < response.options.length; option_index += 1) {
		const option = response.options[option_index];
		sort_list.push(option.question_id);
		(ret[option.question_id].options_if_multiple as number[]).push(option_index);
	}

	const compare_options_by_number = (a: OptionIndex, b: OptionIndex) => {
		const a_number = response.options[a].number;
		const b_number = response.options[b].number;
		return a_number - b_number;	
	};
	for (const question_id of sort_list) {
		(ret[question_id].options_if_multiple as number[]).sort(compare_options_by_number)
	}

	return ret;
};

//## Main Component

function App() {
	//### Constants

	const url_params = new URLSearchParams(window.location.search);
	const survey_id = Number.parseInt(url_params.get("survey_id") ?? "1", 10);

	//### Signals
	
	// Control the current state of the application.
	// "init" - Initial state before/while loading the survey.
	// "error-init" - Error while loading the survey.
	// "success-init" - Survey questions and options have been successfully loaded.
	// "submit" - The survey is currently being submitted.
	// "error-submit" - An error occurred while submitting the answers.
	// "success-submit" - The survey has been successfully submitted.
	const [overallState, setOverallState] = createSignal<"init" | "error-init" | "success-init" | "submit" | "error-submit" | "success-submit">("init");

	// The questions for the survey as is, later fetched from the API.
	const [responseQuestions] = createResource(async () => await fetchQuestions(survey_id));
	// const [responseQuestions, setResponseQuestions] = createSignal<ResponseQuestions | null>(null);
	const [appAllQuestionState, setAppAllQuestionState] = createStore<AppAllQuestionsState>({});

	// Fetch the questions and options for the survey from the API.
	// onMount(async () => {
	// 	try {
	// 		setResponseQuestions(await fetchQuestions(survey_id));
	// 		setOverallState("success-init");
	// 	} catch (error) {
	// 		console.error(error);
	// 		setMessage({ success: false, message: "Unable to load the survey right now." });
	// 		setOverallState("error-init");
	// 	}
	// });

	createEffect(() => {
		const response_questions = responseQuestions();
		if (response_questions) {
			const state = makeStateFromResponseQuestions(response_questions);
			setAppAllQuestionState(state);
		}
	});
	
	// const [answers, setAnswers] = createSignal<Record<number, string>>({});
	// const [result, setResult] = createSignal<ResponseSubmit | null>(null);

	// Custom message to notify the user about the status of the survey submission (e.g., success or failure).
	const [message, setMessage] = createSignal<StatusMessage | null>(null);

	//### Helper Functions

	const questionOptions = (question_id: number) => {
		return appAllQuestionState.
		return appAllQuestionState()
			.filter((option) => option.question_id === questionId)
			.sort((left, right) => left.number - right.number);
	};

	const updateTextAnswer = (questionId: number, value: string) => {
		setAnswers((current) => ({ ...current, [questionId]: value }));
	};

	const selectOption = (questionId: number, optionId: number) => {
		setAnswers((current) => ({ ...current, [questionId]: String(optionId) }));
	};

	const submitSurvey = async () => {
		setSubmitting(true);
		setMessage(null);
		setResult(null);
		try {
			const payload = {
				date: new Date().toISOString(),
				answers: questions().flatMap((question) => {
					const rawValue = answers()[question.id];
					if (typeof rawValue !== "string" || rawValue.trim() === "") {
						return [];
					}

					if (question.type === AnswerType.Text) {
						return [{
							question_id: question.id,
							answer_in_json: JSON.stringify({
								type: AnswerType.Text,
								value: { text: rawValue },
							}),
						}];
					}

					if (question.type === AnswerType.MultipleChoice) {
						const optionId = Number.parseInt(rawValue, 10);
						if (!Number.isFinite(optionId) || optionId <= 0) {
							return [];
						}
						return [{
							question_id: question.id,
							answer_in_json: JSON.stringify({
								type: AnswerType.MultipleChoice,
								value: { question_option_multiple_id: optionId },
							}),
						}];
					}

					return [];
				}),
			};

			if (payload.answers.length === 0) {
				setMessage({ success: false, message: "Please answer at least one question before submitting." });
				return;
			}

			const response = await fetch("/api/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!response.ok) {
				throw new Error("Submission failed.");
			}

			if (isValidResponseSubmit(await response.json())) {
				setResult({ success: true, message: "Thanks! Your anonymous response has been recorded." });
				setMessage({ success: true, message: "Thanks! Your anonymous response has been recorded." });
			} else {
				throw new Error("Invalid response received.");
			}
		} catch (error) {
			console.error(error);
			setResult({ success: false, message: "Your response could not be saved. Please try again." });
			setMessage({ success: false, message: "Your response could not be saved. Please try again." });
		} finally {
			setSubmitting(false);
		}
	};

	//### Render

	return (
		<main class="app-shell">
			<section class="hero-card">
				<p class="eyebrow">Anonymous survey response</p>
				<h1>Share your feedback</h1>
				<p class="subtitle">
					Answer the questions for survey {survey_id} and submit your response anonymously.
				</p>
			</section>

			<MaybeStatusMessage message={message()} />

			<SurveyBody
				loading={overallState() === "loaded"}
				questions={questions()}
				submitting={submitting()}
				answers={answers()}
				options={options()}
				onSubmit={submitSurvey}
				onTextAnswer={updateTextAnswer}
				onSelectOption={selectOption}
			/>
		</main>
	);
}

//## Subcomponents

type StatusMessage = {
	success: boolean;
	message: string;
};

function MaybeStatusMessage(props: {message: StatusMessage | null }) {
	const message = props.message;
	return <Show when={message !== null}>
		<p class={message?.success ? "status success" : "status warning"}>
			{message?.message}
		</p>
	</Show>;
};

type SurveyBodyProps = {
	loading: boolean;
	questions: QuizQuestion[];
	submitting: boolean;
	answers: Record<number, string>;
	options: QuizQuestionOptions[];
	onSubmit: () => void;
	onTextAnswer: (questionId: number, value: string) => void;
	onSelectOption: (questionId: number, optionId: number) => void;
};

function SurveyBody(props: SurveyBodyProps) {
	if (props.loading) {
		return <p class="status">Loading survey questions…</p>;
	}

	if (props.questions.length === 0) {
		return <p class="empty-state">No questions are available for this survey yet.</p>;
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				props.onSubmit();
			}}
		>
			<For each={props.questions}>
				{(question) => {
					const selectedValue = props.answers[question.id] ?? "";
					const questionChoices = props.options
						.filter((option) => option.question_id === question.id)
						.sort((left, right) => left.number - right.number);

					return (
						<QuestionCard
							question={question}
							selectedValue={selectedValue}
							questionChoices={questionChoices}
							onTextAnswer={props.onTextAnswer}
							onSelectOption={props.onSelectOption}
						/>
					);
				}}
			</For>
			<button class="submit-button" type="submit" disabled={props.submitting}>
				{props.submitting ? "Submitting…" : "Submit response"}
			</button>
		</form>
	);
}

type QuestionCardProps = {
	question: QuizQuestion;
	selectedValue: string;
	questionChoices: QuizQuestionOptions[];
	onTextAnswer: (questionId: number, value: string) => void;
	onSelectOption: (questionId: number, optionId: number) => void;
};

function QuestionCard(props: QuestionCardProps) {
	const questionId = props.question.id;
	const selectedValue = props.selectedValue ?? "";

	return (
		<article class="question-card">
			<div class="question-header">
				<p class="question-type">{props.question.type === AnswerType.MultipleChoice ? "Multiple choice" : "Text response"}</p>
				<h2>{props.question.question}</h2>
			</div>
			{props.question.body_text ? <p class="question-body">{props.question.body_text}</p> : null}
			{props.question.img_url ? <img class="question-image" src={props.question.img_url} alt={props.question.question} /> : null}
			{props.question.type === AnswerType.Text ? (
				<textarea
					class="text-input"
					placeholder="Type your answer here"
					value={selectedValue}
					onInput={(event) => props.onTextAnswer(questionId, event.currentTarget.value)}
				></textarea>
			) : (
				<div class="options-grid">
					<For each={props.questionChoices}>
						{(option) => (
							<button
								type="button"
								class={`option-button ${selectedValue === String(option.number) ? "selected" : ""}`}
								onClick={() => props.onSelectOption(questionId, option.number)}
							>
								{option.text_value}
							</button>
						)}
					</For>
				</div>
			)}
		</article>
	);
}

export default App;
