//# Imports

import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  For,
  Match,
  onMount,
  Show,
  splitProps,
  Switch,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { hc } from "hono/client";

import type { infer as z_infer } from "zod/mini";

import type { API } from "@worker/index.ts";
import * as schema from "@worker/schema.ts";

//# Assets

import "./App.css";

//# API Layer

const api_client = hc<API>("/");

//## Common types

type SuccessResponse = z_infer<typeof schema.SuccessResponse>;
type QuestionsResponse = z_infer<typeof schema.QuestionsResponse>;

type SubmitRequest = z_infer<typeof schema.SubmitRequest>;
type SubmitAnswer = SubmitRequest["answers"][number];
type JsonAnswer = z_infer<typeof schema.JsonAnswer>;

//## Fetching and processing

const isValidSuccessResponse = (response: unknown): response is SuccessResponse => {
  const result = schema.SuccessResponse.safeParse(response);
  return result.success;
};

const apiFetch = async <T,>(
  url: string,
  validate_response_fn: (r: unknown) => r is T,
  fetch_opts?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, fetch_opts);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch data from '${url}' with ${response.status} '${response.statusText}'`,
    );
  }
  const data = await response.json();
  if (!validate_response_fn(data)) {
    throw new Error(`Validation failed for response received from '${url}'`);
  }
  return data;
};

const apiFetchPostJson = <T,>(
  url: string,
  validate_response_fn: (r: unknown) => r is T,
  json_object: unknown,
): Promise<T> =>
  apiFetch(url, validate_response_fn, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json_object),
  });

//## /api/{survey_id}/questions

const fetchQuestions = (survey_id: number) =>
  apiFetch(`/api/${survey_id}/questions`, isValidQuestionsResponse);

const isValidQuestionsResponse = (response: any): response is QuestionsResponse => {
  const result = api.QuestionsResponse.safeParse(response);
  return result.success;
};

//## /api/submit

type SubmitResponse = SuccessResponse;

const fetchSubmit = (answers: SubmitAnswer[]) =>
  apiFetchPostJson("/api/submit", isValidSubmitResponse, makeSubmitRequest(answers));

const isValidSubmitResponse: (r: any) => r is SubmitResponse = isValidSuccessResponse;

const makeSubmitRequest = (answers: SubmitAnswer[]): SubmitRequest => {
  return {
    date: new Date().toISOString(),
    answers: answers,
  };
};

const makeSubmitAnswerForText = (
  question_id: number,
  text: string,
  large: boolean,
): SubmitAnswer => {
  const answer: JsonAnswer = {
    type: api.AnswerType.Text,
    large: large,
    text: text,
  };
  return {
    question_id: question_id,
    json_answer: JSON.stringify(answer),
  };
};

const makeSubmitAnswerForMultiple = (
  question_id: number,
  question_option_id: number,
): SubmitAnswer => {
  const answer: JsonAnswer = {
    type: api.AnswerType.Multiple,
    question_option_id: question_option_id,
  };
  return {
    question_id: question_id,
    json_answer: JSON.stringify(answer),
  };
};

//# Frontend Components

//## State manipulation

type QuestionId = string;
type OptionId = string;

// Internal representation for responseQuestions
type AppQuestionsResponse = z_infer<typeof schema.QuestionsResponse>;

type AppSubmitAnswers = Record<QuestionId, JsonAnswer>;

const makeAppSubmitAnswers = (aqr: AppQuestionsResponse): AppSubmitAnswers => {
  const ret: AppSubmitAnswers = {};

  for (const [question_id, question] of Object.entries(aqr.questions)) {
    let answer: JsonAnswer;
    switch (question.type) {
      case schema.AnswerType.Text:
        answer = {
          type: schema.AnswerType.Text,
          large: false,
          text: "",
        };
        break;
      case schema.AnswerType.Multiple:
        answer = {
          type: schema.AnswerType.Multiple,
          question_option_id: -1,
        };
        break;
      default:
        throw Error(`Invalid type for question with id = ${question_id}`);
    }

    ret[question_id] = answer;
  }

  return ret;
};

// Assumes that response.options is ordered by question_id
// const makeStateFromResponseQuestions = (response: ResponseQuestions): AppAllQuestionsState => {
// 	const ret: AppAllQuestionsState = {};

// 	for (const question of response.questions) {
// 		let state: AppQuestionState;
// 		switch (question.type) {
// 			case AnswerType.Text:
// 				state = {
// 					answer: { large: false, text: "" } as AnswerForText,
// 				};
// 				break;
// 			case AnswerType.MultipleChoice:
// 				state = {
// 					answer: { question_option_multiple_id: -1 } as AnswerForMultiple,
// 					options_if_multiple: [],
// 				};
// 				break;
// 			default:
// 				throw new Error(`Unknown type '${question.type}' from question 'id: ${question.id}'`);
// 		}
// 		ret[question.id] = state;
// 	}

// 	let sort_list: Set<QuestionId> = new Set();
// 	for (let option_index = 0; option_index < response.options.length; option_index += 1) {
// 		const option = response.options[option_index];
// 		sort_list.add(option.question_id);

// 		ret[option.question_id].options_if_multiple!.push(option_index);
// 	}

// 	const compare_options_by_number = (a: OptionIndex, b: OptionIndex) => {
// 		const a_number = response.options[a].number;
// 		const b_number = response.options[b].number;
// 		return a_number - b_number;
// 	};
// 	for (const question_id of sort_list.keys()) {
// 		ret[question_id].options_if_multiple!.sort(compare_options_by_number)
// 	}

// 	return ret;
// };

//## Main Component

type Status =
  | { status: "init" }
  | { status: "fatal"; message: string }
  | { status: "error"; message: string }
  | { status: "questions-loaded" }
  | { status: "submitting" }
  | { status: "submitted" };

function App() {
  //### Constants

  const url_params = new URLSearchParams(globalThis.location.search);

  const survey_id_param = url_params.get("survey_id") ?? "1";
  const survey_id_result = schema.Index.safeParse(Number(survey_id_param));
  const survey_id = survey_id_result.success ? survey_id_result.data : 0;

  console.log(`survey loaded: ${survey_id}`);

  //### Signals

  // Custom message to notify the user about the status of the survey submission (e.g., success or failure).
  const [status, setStatus] = createSignal<Status>({ status: "init" });

  const sleep = (time_millis: number) =>
    new Promise((accept, _) => setTimeout(() => accept(undefined), time_millis));

  createEffect(async () => {
    await sleep(1000);
    const r = await api_client.api.$get();
    if (r.ok) {
      const data = await r.json() as z_infer<typeof schema.SuccessResponse>;
      console.log("oh no no");
    }

    console.log("oh no");
    setStatus({ status: "error", message: "nope quest for yout" });
  });

  // Control the current state of the application.
  // "init" - Initial state before/while loading the survey.
  // "error-init" - Error while loading the survey.
  // "success-init" - Survey questions and options have been successfully loaded.
  // "submit" - The survey is currently being submitted.
  // "error-submit" - An error occurred while submitting the answers.
  // "success-submit" - The survey has been successfully submitted.
  // const [overallState, setOverallState] = createSignal<
  //   "init" | "error-init" | "success-init" | "submit" | "error-submit" | "success-submit"
  // >("init");

  // The questions for the survey as is, later fetched from the API.
  // const [appQuestionsResponse] = createResource(async () => await fetchQuestions(survey_id));

  // Answers for each question
  // const [appSubmitAnswers, setAppSubmitAnswers] = createStore<AppSubmitAnswers>({});

  // createEffect(() => {
  //   const aqr = appQuestionsResponse();
  //   if (aqr) {
  //     setAppSubmitAnswers(makeAppSubmitAnswers(aqr));
  //     setStatus({ status: "questions-loaded" });
  //   } else {
  //     setAppSubmitAnswers({});
  //     setStatus({ status: "init" });
  //   }
  // });

  //### Helper functions

  // const [responseQuestions, setResponseQuestions] = createSignal<ResponseQuestions | null>(null);

  // Internal data representation for the questions. Used for displaying and submitting data.
  // const [appAllQuestionState, setAppAllQuestionState] = createStore<AppAllQuestionsState>({});

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

  // createEffect(() => {
  // 	const response_questions = appQuestionsResponse();
  // 	if (response_questions) {
  // 		const state = makeStateFromResponseQuestions(response_questions);
  // 		setAppAllQuestionState(state);
  // 	}
  // });

  // const [answers, setAnswers] = createSignal<Record<number, string>>({});
  // const [result, setResult] = createSignal<ResponseSubmit | null>(null);

  //### Helper Functions

  // const getQuestion = (question_id: QuestionId): QuizQuestion | undefined => {
  // 	return appQuestionsResponse()?.questions[question_id];
  // };

  // const getQuestionOption = (option_id: OptionIndex): QuizQuestionOption | undefined => {
  // 	return appQuestionsResponse()?.options[option_id];
  // };

  // const getQuestionOptions = (question_id: QuestionId): QuizQuestionOption[] | undefined => {
  // 	const options = appQuestionsResponse()?.options;
  // 	if (!options) return undefined;

  // 	const options_indexes = appAllQuestionState[question_id].options_if_multiple;
  // 	if (!options_indexes) return undefined;

  // 	return options_indexes.map((option_id) => options[option_id]);
  // };

  // const updateTextAnswer = (question_id: QuestionId, value: string) => {
  // 	//@ts-expect-error Solid does not handle type aliases correctly so the third argument type appears as `Never`
  // 	//                 but it's actually `keyof AnswerForText`
  // 	setAppAllQuestionState(question_id, "answer", "text", value);
  // };

  // const selectOption = (question_id: QuestionId, option_id: QuestionId) => {
  // 	const option_db_id = getQuestionOption(option_id)?.id;
  // 	if (!option_db_id) return undefined;
  // 	//@ts-expect-error Solid does not handle type aliases correctly so the third argument type appears as `Never`
  // 	//                 but it's actually `keyof AnswerForMultiple`
  // 	setAppAllQuestionState(question_id, "answer", "question_option_multiple_id", option_db_id);
  // };

  // const submitSurvey = async () => {

  // 	setSubmitting(true);
  // 	setStatus(null);
  // 	setResult(null);
  // 	try {
  // 		const payload = {
  // 			date: new Date().toISOString(),
  // 			answers: questions().flatMap((question) => {
  // 				const rawValue = answers()[question.id];
  // 				if (typeof rawValue !== "string" || rawValue.trim() === "") {
  // 					return [];
  // 				}

  // 				if (question.type === AnswerType.Text) {
  // 					return [{
  // 						question_id: question.id,
  // 						answer_in_json: JSON.stringify({
  // 							type: AnswerType.Text,
  // 							value: { text: rawValue },
  // 						}),
  // 					}];
  // 				}

  // 				if (question.type === AnswerType.MultipleChoice) {
  // 					const optionId = Number.parseInt(rawValue, 10);
  // 					if (!Number.isFinite(optionId) || optionId <= 0) {
  // 						return [];
  // 					}
  // 					return [{
  // 						question_id: question.id,
  // 						answer_in_json: JSON.stringify({
  // 							type: AnswerType.MultipleChoice,
  // 							value: { question_option_multiple_id: optionId },
  // 						}),
  // 					}];
  // 				}

  // 				return [];
  // 			}),
  // 		};

  // 		if (payload.answers.length === 0) {
  // 			setStatus({ success: false, message: "Please answer at least one question before submitting." });
  // 			return;
  // 		}

  // 		const response = await fetch("/api/submit", {
  // 			method: "POST",
  // 			headers: { "Content-Type": "application/json" },
  // 			body: JSON.stringify(payload),
  // 		});
  // 		if (!response.ok) {
  // 			throw new Error("Submission failed.");
  // 		}

  // 		if (isValidSubmitResponse(await response.json())) {
  // 			setResult({ success: true, message: "Thanks! Your anonymous response has been recorded." });
  // 			setStatus({ success: true, message: "Thanks! Your anonymous response has been recorded." });
  // 		} else {
  // 			throw new Error("Invalid response received.");
  // 		}
  // 	} catch (error) {
  // 		console.error(error);
  // 		setResult({ success: false, message: "Your response could not be saved. Please try again." });
  // 		setStatus({ success: false, message: "Your response could not be saved. Please try again." });
  // 	} finally {
  // 		setSubmitting(false);
  // 	}
  // };

  //### Render

  return (
    <main class="app-shell">
      <section class="hero-card">
        <p class="eyebrow">Anonymous survey response</p>
        <h1>Share your feedback</h1>
      </section>

      <DisplayStatusBlock status={status()} />

      <Switch>
        <Match when={status().status == "init"}>
          <LoadingQuestionsBlock />
        </Match>
        <Match when={status().status in ["error", "questions-loaded", "submitting"]}>
          <span>ok showing</span>
          {
            // <SurveyBody
            //   questions={questions()}
            //   submitting={submitting()}
            //   answers={answers()}
            //   options={options()}
            //   onSubmit={submitSurvey}
            //   onTextAnswer={updateTextAnswer}
            //   onSelectOption={selectOption}
            // -->
          }
        </Match>
      </Switch>
    </main>
  );
}

//## Subcomponents

function DisplayStatusBlock(props: { status: Status }) {
  const [{ status }] = splitProps(props, ["status"]);
  createEffect(() => {
    console.log(status);
  });
  let message = null;
  switch (status.status) {
    case "init":
      message = "Cargando preguntas...";
      break;
    case "error":
    case "fatal":
      message = status.message;
      break;
    case "submitted":
      message = "Gracias! Respuestas enviadas!";
      break;
  }
  const style_classes = !(status.status in ["error", "fatal"])
    ? "status success"
    : "status warning";

  return (
    <Show when={message}>
      <p on:click={() => console.log(status)} class={style_classes}>
        {message}
      </p>
    </Show>
  );
}

const LoadingQuestionsBlock = () => {
  // TODO: Loading animation
  return <span>wahhh</span>;
};

type SurveyBodyProps = {
  questions: QuizQuestion[];
  submitting: boolean;
  answers: Record<number, string>;
  options: QuizQuestionOption[];
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
  questionChoices: QuizQuestionOption[];
  onTextAnswer: (questionId: number, value: string) => void;
  onSelectOption: (questionId: number, optionId: number) => void;
};

function QuestionCard(props: QuestionCardProps) {
  const questionId = props.question.id;
  const selectedValue = props.selectedValue ?? "";

  return (
    <article class="question-card">
      <div class="question-header">
        <p class="question-type">
          {props.question.type === AnswerType.MultipleChoice ? "Multiple choice" : "Text response"}
        </p>
        <h2>{props.question.question}</h2>
      </div>
      {props.question.body_text ? <p class="question-body">{props.question.body_text}</p> : null}
      {props.question.img_url
        ? (
          <img
            class="question-image"
            src={props.question.img_url}
            alt={props.question.question}
          />
        )
        : null}
      {props.question.type === AnswerType.Text
        ? (
          <textarea
            class="text-input"
            placeholder="Type your answer here"
            value={selectedValue}
            onInput={(event) => props.onTextAnswer(questionId, event.currentTarget.value)}
          >
          </textarea>
        )
        : (
          <div class="options-grid">
            <For each={props.questionChoices}>
              {(option) => (
                <button
                  type="button"
                  class={`option-button ${
                    selectedValue === String(option.number) ? "selected" : ""
                  }`}
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
