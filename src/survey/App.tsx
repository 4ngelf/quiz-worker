//# Imports

import {
  createEffect,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  splitProps,
  Suspense,
  Switch,
} from "solid-js";
import type { Setter } from "solid-js";
import { createStore } from "solid-js/store";
import { useParams } from "@solidjs/router";
import { hc } from "hono/client";
import type { infer as z_infer } from "zod/mini";

import type { API } from "@worker/index.ts";
import * as schema from "@worker/schema.ts";

//# Assets

import "./App.css";

//# API Layer

const api_client = hc<API>("/");

//## Types

// Types extracted from schema and api
// deno-lint-ignore no-namespace
namespace schema_type {
  export type QuestionId = string;
  export type QuestionsResponse = z_infer<typeof schema.QuestionsResponse>;
  export type SubmitRequest = z_infer<typeof schema.SubmitRequest>;
  export type JsonAnswerValue = z_infer<typeof schema.JsonAnswer>;
  export type SuccessResponse = z_infer<typeof schema.SuccessResponse>;
}

//# Frontend Components

//## State manipulation

// Internal representation for responseQuestions
// deno-lint-ignore no-namespace
namespace processed {
  export type Questions = Record<string, processed.Question | processed.QuestionWithOptions>;

  export type Question = schema_type.QuestionsResponse["questions"][string];
  export type Option = schema_type.QuestionsResponse["options"][string];
  export type QuestionWithOptions = processed.Question & { options: processed.Option[] };
}

const processQuestionsResponse = (qr: schema_type.QuestionsResponse): processed.Questions => {
  const questions: processed.Questions = {};
  for (const [question_id, question] of Object.entries(qr.questions)) {
    if (question.type === schema.AnswerType.Multiple) {
      questions[question_id] = { ...question, options: [] };
    } else {
      questions[question_id] = { ...question };
    }
  }
  const sort_list: Set<string> = new Set();
  for (const option of Object.values(qr.options)) {
    const option_question_id = option.question_id.toString(10);
    const question = questions[option_question_id] as processed.QuestionWithOptions;
    sort_list.add(option_question_id);
    question.options.push(option);
  }
  for (const option_question_id of sort_list) {
    const question = questions[option_question_id] as processed.QuestionWithOptions;
    question.options.sort((a, b) => a.number - b.number);
  }
  return questions;
};

type AnswersData = Record<schema_type.QuestionId, schema_type.JsonAnswerValue>;

const makeAnswersData = (pqr: processed.Questions): AnswersData => {
  const ret: AnswersData = {};

  for (const [question_id, question] of Object.entries(pqr)) {
    let answer: schema_type.JsonAnswerValue;
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

const processAnswersData = (ad: AnswersData): schema_type.SubmitRequest => {
  const date = new Date().toISOString();
  const answers: schema_type.SubmitRequest["answers"] = [];
  for (const [question_id, answer] of Object.entries(ad)) {
    answers.push({
      question_id: question_id,
      json_answer: JSON.stringify(answer),
    });
  }

  return { date: date, answers: answers };
};

//## Main Component

type Status =
  | { status: "fatal"; message: string }
  | { status: "error"; message: string }
  | { status: "submitting" }
  | { status: "submitted" };

const App = () => {
  //### Constants

  const params = useParams();
  const survey_id = params.survey_id!;

  console.log(`survey loaded: ${survey_id}`);

  //### Signals

  const [getStatus, setStatus] = createSignal<Status | null>(null);
  const [answers_data, setAnswersData] = createStore<AnswersData>({});
  const [getSubmitPayload, setSubmitPayload] = createSignal<schema_type.SubmitRequest | null>(null);

  //### API resources

  const fetchQuestions = async (survey_id: string) => {
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

    const processed_questions = processQuestionsResponse(questions.data);

    setAnswersData(makeAnswersData(processed_questions));

    return processed_questions;
  };

  const fetchSubmit = async (submit_payload: schema_type.SubmitRequest | null) => {
    if (!submit_payload) return;

    const r = await api_client.api.survey.submit.$post({
      json: submit_payload,
    });

    let failed = false;
    if (r.ok) {
      const rj = await r.json() as schema_type.SuccessResponse;
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

  const onAnswerSetAnswersData = (
    question_id: number,
    answer_value: schema_type.JsonAnswerValue,
  ): void => {
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

  const onSubmitSendAnswers = (_: Event) => {
    if (!checkedAllAnswers()) {
      setStatus({ status: "error", message: "Todavia hay preguntas sin responder" });
      return;
    }
    setStatus({ status: "submitting" });
    const submit_request = processAnswersData(answers_data);
    setSubmitPayload(submit_request);
  };

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
            questions_data={getQuestionsData()!}
            setStatus={setStatus}
            onAnswer={onAnswerSetAnswersData}
          />
        </Show>
        <SubmitButtonBlock onClick={onSubmitSendAnswers} disabled={isSubmitting()} />
      </Suspense>
    </main>
  );
};

const QuestionsBodyBlock = (props: {
  questions_data: processed.Questions;
  setStatus: Setter<Status | null>;
  onAnswer: (question_id: number, answer_value: schema_type.JsonAnswerValue) => void;
}) => (
  <div>
    <For each={Object.values(props.questions_data)}>
      {(question) => {
        //### Helpers

        const questionTypeText = () => {
          switch (question.type) {
            case schema.AnswerType.Multiple:
              return "Multiple choice";
            case schema.AnswerType.Text:
              return "Text response";
            default:
              throw new Error("Programming error: question type not handled");
          }
        };

        //### Events

        const onSelectChoice = (option_id: number) => {
          const answer: schema_type.JsonAnswerValue = {
            type: schema.AnswerType.Multiple,
            question_option_id: option_id,
          };
          props.onAnswer(question.id, answer);
        };

        const onInputTextType = (inserted_text: string) => {
          const answer: schema_type.JsonAnswerValue = {
            type: schema.AnswerType.Text,
            text: inserted_text,
            large: false,
          };
          props.onAnswer(question.id, answer);
        };

        //### Render

        return (
          <article class="question-card">
            <div class="question-header">
              <p class="question-type">{questionTypeText()}</p>
              <h2>{question.question}</h2>
            </div>
            <Show when={question.body_text}>
              <p class="question-body">{question.body_text}</p>
            </Show>
            <Show when={question.img_url}>
              <img class="question-image" src={question.img_url!} alt={question.question} />
            </Show>
            <Switch>
              <Match when={question.type === schema.AnswerType.Multiple}>
                <MultipleChoiceBlock
                  choices={(question as processed.QuestionWithOptions).options}
                  onSelectChoice={onSelectChoice}
                />
              </Match>
              <Match when={question.type === schema.AnswerType.Text}>
                <TextAreaBlock onInput={onInputTextType} />
              </Match>
            </Switch>
          </article>
        );
      }}
    </For>
  </div>
);

//## Subcomponents

const LoadingQuestionsBlock = () => {
  // TODO: Loading animation
  return <span>Cargando preguntas...</span>;
};

const DisplayStatusBlock = (props: { status: Status | null }) => {
  ///### Constants

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

  ///### Render

  return (
    <p class={style ?? "status warning"}>
      {message}
    </p>
  );
};

const TextAreaBlock = (props: {
  onInput: (inserted_text: string) => void;
}) => (
  <textarea
    class="text-input"
    placeholder="Type your answer here"
    onInput={(e) => props.onInput(e.currentTarget.value)}
  >
  </textarea>
);

const MultipleChoiceBlock = (props: {
  choices: processed.Option[];
  onSelectChoice: (option_id: number) => void;
}) => {
  //### Signals

  const [getSelectedId, setSelectedId] = createSignal<number>(-1);

  createEffect(() => {
    const sn = getSelectedId();
    if (sn !== -1) props.onSelectChoice(sn);
  });

  //### Helpers

  const buttonStyle = (option_id: number) => {
    if (getSelectedId() === option_id) return "option-button selected";
    else return "option-button";
  };

  //### Render

  return (
    <div class="options-grid">
      <For each={props.choices}>
        {(option) => (
          <button
            type="button"
            class={buttonStyle(option.id)}
            onClick={() => setSelectedId(option.id)}
          >
            {option.text_value}
          </button>
        )}
      </For>
    </div>
  );
};

const SubmitButtonBlock = (props: {
  onClick: (e: Event) => void;
  disabled: boolean;
}) => (
  <button on:click={props.onClick} class="submit-button" type="submit" disabled={props.disabled}>
    Submit response
  </button>
);

//# Export application

export default App;
