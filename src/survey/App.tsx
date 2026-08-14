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
  Suspense,
  Switch,
  useContext,
} from "solid-js";
import type { Setter } from "solid-js";
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

// type SuccessResponse = z_infer<typeof schema.SuccessResponse>;
// type QuestionsResponse = z_infer<typeof schema.QuestionsResponse>;
//
// type SubmitRequest = z_infer<typeof schema.SubmitRequest>;
// type SubmitAnswer = SubmitRequest["answers"][number];
// type JsonAnswer = z_infer<typeof schema.JsonAnswer>;
//
// //## Fetching and processing
//
// const isValidSuccessResponse = (response: unknown): response is SuccessResponse => {
//   const result = schema.SuccessResponse.safeParse(response);
//   return result.success;
// };
//
// const apiFetch = async <T,>(
//   url: string,
//   validate_response_fn: (r: unknown) => r is T,
//   fetch_opts?: RequestInit,
// ): Promise<T> => {
//   const response = await fetch(url, fetch_opts);
//   if (!response.ok) {
//     throw new Error(
//       `Failed to fetch data from '${url}' with ${response.status} '${response.statusText}'`,
//     );
//   }
//   const data = await response.json();
//   if (!validate_response_fn(data)) {
//     throw new Error(`Validation failed for response received from '${url}'`);
//   }
//   return data;
// };
//
// const apiFetchPostJson = <T,>(
//   url: string,
//   validate_response_fn: (r: unknown) => r is T,
//   json_object: unknown,
// ): Promise<T> =>
//   apiFetch(url, validate_response_fn, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(json_object),
//   });
//
// //## /api/{survey_id}/questions
//
// const fetchQuestions = (survey_id: number) =>
//   apiFetch(`/api/${survey_id}/questions`, isValidQuestionsResponse);
//
// const isValidQuestionsResponse = (response: any): response is QuestionsResponse => {
//   const result = schema.QuestionsResponse.safeParse(response);
//   return result.success;
// };
//
// //## /api/submit
//
// type SubmitResponse = SuccessResponse;
//
// const fetchSubmit = (answers: SubmitAnswer[]) =>
//   apiFetchPostJson("/api/submit", isValidSubmitResponse, makeSubmitRequest(answers));
//
// const isValidSubmitResponse: (r: any) => r is SubmitResponse = isValidSuccessResponse;
//
// const makeSubmitRequest = (answers: SubmitAnswer[]): SubmitRequest => {
//   return {
//     date: new Date().toISOString(),
//     answers: answers,
//   };
// };
//
// const makeSubmitAnswerForText = (
//   question_id: number,
//   text: string,
//   large: boolean,
// ): SubmitAnswer => {
//   const answer: JsonAnswer = {
//     type: schema.AnswerType.Text,
//     large: large,
//     text: text,
//   };
//   return {
//     question_id: question_id,
//     json_answer: JSON.stringify(answer),
//   };
// };
//
// const makeSubmitAnswerForMultiple = (
//   question_id: number,
//   question_option_id: number,
// ): SubmitAnswer => {
//   const answer: JsonAnswer = {
//     type: schema.AnswerType.Multiple,
//     question_option_id: question_option_id,
//   };
//   return {
//     question_id: question_id,
//     json_answer: JSON.stringify(answer),
//   };
// };

//# Frontend Components

//## State manipulation

type QuestionId = string;

// Internal representation for responseQuestions
type QuestionsResponse = z_infer<typeof schema.QuestionsResponse>;
type SubmitRequest = z_infer<typeof schema.SubmitRequest>;
type JsonAnswerValue = z_infer<typeof schema.JsonAnswer>;
type SuccessResponse = z_infer<typeof schema.SuccessResponse>;

type AnswersData = Record<QuestionId, JsonAnswerValue>;

const makeAnswersData = (qr: QuestionsResponse): AnswersData => {
  const ret: AnswersData = {};

  for (const [question_id, question] of Object.entries(qr.questions)) {
    let answer: JsonAnswerValue;
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

const processAnswersData = (ad: AnswersData): SubmitRequest => {
  const date = new Date().toISOString();
  const answers: SubmitRequest["answers"] = [];
  for (const [question_id, answer] of Object.entries(ad)) {
    answers.push({
      question_id: question_id,
      json_answer: JSON.stringify(answer),
    });
  }

  return { date: date, answers: answers };
};

const sleepPromise = (milliseconds: number): Promise<void> =>
  new Promise((accept) => setTimeout(() => accept(undefined), milliseconds));

//## Main Component

type Status =
  | { status: "fatal"; message: string }
  | { status: "error"; message: string }
  | { status: "submitting" }
  | { status: "submitted" };

function App() {
  //### Constants

  const url_params = new URLSearchParams(globalThis.location.search);
  const survey_id = url_params.get("survey_id") ?? "1";

  console.log(`survey loaded: ${survey_id}`);

  //### Signals

  const [getStatus, setStatus] = createSignal<Status | null>(null);
  const [answers_data, setAnswersData] = createStore<AnswersData>({});
  const [getSubmitPayload, setSubmitPayload] = createSignal<SubmitRequest | null>(null);

  //### Api resources

  const fetchQuestions = async (survey_id: string) => {
    // await sleepPromise(1000);

    const r = await api_client.api.survey[":survey_id"].questions.$get({
      param: { survey_id: survey_id },
    });
    if (!r.ok) throw new Error("Falla al recibir preguntas de la encuesta");

    const questions_response_json = await r.json();
    const questions = schema.QuestionsResponse.safeParse(questions_response_json);
    if (!questions.success) {
      throw new Error(
        `Falla al procesar preguntas de la encuesta.\nError: ${questions.error}`,
      );
    }

    setAnswersData(makeAnswersData(questions.data));

    return questions.data;
  };

  const fetchSubmit = async (submit_payload: SubmitRequest | null) => {
    if (!submit_payload) return;

    const r = await api_client.api.survey.submit.$post({
      json: submit_payload,
    });

    let failed = false;
    if (r.ok) {
      const rj = await r.json() as SuccessResponse;
      if (!rj.success) {
        failed = true;
      }
    } else {
      failed = true;
    }
    if (failed) throw new Error("Falla al subir tus respuestas.");

    setStatus({ status: "submitted" });
  };

  const [getQuestionsData] = createResource(() => survey_id, fetchQuestions);
  const [_, _submitDataMethods] = createResource(getSubmitPayload, fetchSubmit);

  //### Helper functions

  const isSubmitting = () => {
    const status = getStatus();
    return status ? status.status == "submitting" : false;
  };

  const checkedAllAnswers = () => {
    for (const [_, answer] of Object.entries(answers_data)) {
      switch (answer.type) {
        case schema.AnswerType.Text:
          if (answer.text === "") return false;
          break;
        case schema.AnswerType.Multiple:
          if (answer.question_option_id === -1) return false;
          break;
        default:
          throw new Error("Programming error: Answer type not handled");
      }
    }
    return true;
  };

  //### Events

  const onAnswerSetAnswersData = (question_id: number, answer_value: JsonAnswerValue): void => {
    const question_key = question_id.toString(10);
    if (answers_data[question_key].type != answer_value.type) {
      setStatus({
        status: "error",
        message:
          `Programming error: Answer Type does not correspond to question type for id ${question_id}`,
      });
      return;
    }

    setAnswersData(question_key, answer_value);
    console.debug(`Question(${question_key}) = ${answer_value}`);
  };

  const onSubmitAnswers = (_: Event) => {
    if (!checkedAllAnswers()) {
      setStatus({ status: "error", message: "Todavia hay preguntas sin responder" });
      return;
    }
    setStatus({ status: "submitting" });
    const submit_request = processAnswersData(answers_data);
    setSubmitPayload(submit_request);
  };

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
  //
  // };

  //### Render

  return (
    <main class="app-shell">
      <section class="hero-card">
        <p class="eyebrow">Anonymous survey response</p>
        <h1>Share your feedback</h1>
      </section>

      <DisplayStatusBlock status={getStatus()} />
      <Suspense fallback={<LoadingQuestionsBlock />}>
        <Show when={getQuestionsData.state === "ready"}>
          <QuestionsBodyBlock
            questions_data={getQuestionsData() as QuestionsResponse}
            setStatus={setStatus}
            onAnswer={onAnswerSetAnswersData}
          />
        </Show>
        <SubmitButtonBlock onClick={onSubmitAnswers} disabled={isSubmitting()} />
      </Suspense>
    </main>
  );
}

const QuestionsBodyBlock = (props: {
  questions_data: QuestionsResponse;
  setStatus: Setter<Status | null>;
  onAnswer: (question_id: number, answer_value: JsonAnswerValue) => void;
}) => {
  return (
    <div>
      <For each={Object.values(props.questions_data.questions)}>
        {(item, key) => (
          <div>
            #{JSON.stringify(item)} = {key()}
          </div>
        )}
      </For>
    </div>
  );
};

const QuestionCardBlock = (props: {
  question: QuestionsResponse["questions"][string];
}) => {
  // const questionId = props.question.id;
  // const selectedValue = props.selectedValue ?? "";

  return (
    <article class="question-card">
      <div class="question-header">
        <p class="question-type">
          {props.question.type === schema.AnswerType.Multiple ? "Multiple choice" : "Text response"}
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
    </article>
  );
};
// {props.question.type === AnswerType.Text
//   ? (
//     <textarea
//       class="text-input"
//       placeholder="Type your answer here"
//       value={selectedValue}
//       onInput={(event) => props.onTextAnswer(questionId, event.currentTarget.value)}
//     >
//     </textarea>
//   )
//   : (
//     <div class="options-grid">
//       <For each={props.questionChoices}>
//         {(option) => (
//           <button
//             type="button"
//             class={`option-button ${
//               selectedValue === String(option.number) ? "selected" : ""
//             }`}
//             onClick={() => props.onSelectOption(questionId, option.number)}
//           >
//             {option.text_value}
//           </button>
//         )}
//       </For>
//     </div>
//   )}

//## Subcomponents

const LoadingQuestionsBlock = () => {
  // TODO: Loading animation
  return <span>Cargando preguntas...</span>;
};

const DisplayStatusBlock = (props: { status: Status | null }) => {
  const [{ status }] = splitProps(props, ["status"]);
  if (!status) return;

  let message = null;
  let style = null;
  switch (status.status) {
    case "error":
    case "fatal":
      message = status.message;
      style = "status error";
      break;
    case "submitted":
      message = "Gracias! Respuestas enviadas!";
      style = "status success";
      break;
  }
  if (!message) return;

  return (
    <p class={style ?? "status warning"}>
      {message}
    </p>
  );
};

const SubmitButtonBlock = (props: {
  onClick: (e: Event) => void;
  disabled: boolean;
}) => {
  return (
    <button on:click={props.onClick} class="submit-button" type="submit" disabled={props.disabled}>
      Submit response
    </button>
  );
};

// type SurveyBodyProps = {
//   questions: QuizQuestion[];
//   submitting: boolean;
//   answers: Record<number, string>;
//   options: QuizQuestionOption[];
//   onSubmit: () => void;
//   onTextAnswer: (questionId: number, value: string) => void;
//   onSelectOption: (questionId: number, optionId: number) => void;
// };
//
// function SurveyBody(props: SurveyBodyProps) {
//   if (props.loading) {
//     return <p class="status">Loading survey questions…</p>;
//   }
//
//   if (props.questions.length === 0) {
//     return <p class="empty-state">No questions are available for this survey yet.</p>;
//   }
//
//   return (
//     <form
//       onSubmit={(event) => {
//         event.preventDefault();
//         props.onSubmit();
//       }}
//     >
//       <For each={props.questions}>
//         {(question) => {
//           const selectedValue = props.answers[question.id] ?? "";
//           const questionChoices = props.options
//             .filter((option) => option.question_id === question.id)
//             .sort((left, right) => left.number - right.number);
//
//           return (
//             <QuestionCard
//               question={question}
//               selectedValue={selectedValue}
//               questionChoices={questionChoices}
//               onTextAnswer={props.onTextAnswer}
//               onSelectOption={props.onSelectOption}
//             />
//           );
//         }}
//       </For>
//       <button class="submit-button" type="submit" disabled={props.submitting}>
//         {props.submitting ? "Submitting…" : "Submit response"}
//       </button>
//     </form>
//   );
// }

// type QuestionCardProps = {
//   question: QuizQuestion;
//   selectedValue: string;
//   questionChoices: QuizQuestionOption[];
//   onTextAnswer: (questionId: number, value: string) => void;
//   onSelectOption: (questionId: number, optionId: number) => void;
// };
//
// function QuestionCard(props: QuestionCardProps) {
//   const questionId = props.question.id;
//   const selectedValue = props.selectedValue ?? "";
//
//   return (
//     <article class="question-card">
//       <div class="question-header">
//         <p class="question-type">
//           {props.question.type === AnswerType.MultipleChoice ? "Multiple choice" : "Text response"}
//         </p>
//         <h2>{props.question.question}</h2>
//       </div>
//       {props.question.body_text ? <p class="question-body">{props.question.body_text}</p> : null}
//       {props.question.img_url
//         ? (
//           <img
//             class="question-image"
//             src={props.question.img_url}
//             alt={props.question.question}
//           />
//         )
//         : null}
//       {props.question.type === AnswerType.Text
//         ? (
//           <textarea
//             class="text-input"
//             placeholder="Type your answer here"
//             value={selectedValue}
//             onInput={(event) => props.onTextAnswer(questionId, event.currentTarget.value)}
//           >
//           </textarea>
//         )
//         : (
//           <div class="options-grid">
//             <For each={props.questionChoices}>
//               {(option) => (
//                 <button
//                   type="button"
//                   class={`option-button ${
//                     selectedValue === String(option.number) ? "selected" : ""
//                   }`}
//                   onClick={() => props.onSelectOption(questionId, option.number)}
//                 >
//                   {option.text_value}
//                 </button>
//               )}
//             </For>
//           </div>
//         )}
//     </article>
//   );
// }
//
export default App;
