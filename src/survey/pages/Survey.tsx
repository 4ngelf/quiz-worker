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
import { useNavigate, useParams } from "@solidjs/router";
import { hc } from "hono/client";
import type { infer as z_infer } from "zod/mini";

import type { API } from "@worker/index.ts";
import * as schema from "@worker/schema.ts";

//# Assets

import "./Survey.css";

//# API Layer

const sessionId = crypto.randomUUID();
const api_client = hc<API>("/", {
  headers: {
    "X-Session": sessionId,
  },
});

//## Types

// Types extracted from schema and api
// deno-lint-ignore no-namespace
namespace schema_type {
  export type QuestionId = string;
  export type QuestionsResponseFull = z_infer<typeof schema.QuestionsResponse2>;
  export type Question2 = z_infer<typeof schema.Question2>;
  export type Option = z_infer<typeof schema.QuestionOption>;
  export type SubmitRequest = z_infer<typeof schema.SubmitRequest>;
  export type JsonAnswerValue = z_infer<typeof schema.JsonAnswer>;
  export type SuccessResponse = z_infer<typeof schema.SuccessResponse>;
}

//# Frontend Components

//## State manipulation

// Internal representation for responseQuestions
// deno-lint-ignore no-namespace
namespace processed {
  export type Questions = Record<string, schema_type.Question2>;

  export type Question = schema_type.Question2;
  export type QuestionWithOptions = Question & { options: NonNullable<Question["options"]> };
}

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
        if ((question.max_options ?? 1) > 1) {
          answer = {
            type: schema.AnswerType.Multiple,
            question_option_ids: [],
          };
        } else {
          answer = {
            type: schema.AnswerType.Multiple,
            question_option_id: -1,
          };
        }
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

  const navigate = useNavigate();

  const params = useParams();
  const survey_id = params.survey_id!;

  console.log(`survey loaded: ${survey_id}`);

  //### Signals

  const [getStatus, setStatus] = createSignal<Status | null>(null);
  const [answers_data, setAnswersData] = createStore<AnswersData>({});
  const [getSubmitPayload, setSubmitPayload] = createSignal<schema_type.SubmitRequest | null>(null);

  //### API resources

  const fetchQuestions = async (survey_id: string) => {
    console.log(`Fetching questions for survey: ${survey_id}`);
    const r = await api_client.api.survey[":survey_id"].questions.$get({
      param: { survey_id: survey_id },
    });
    console.log(`Response status: ${r.status}`);
    if (!r.ok) {
      const error_text = await r.text();
      console.error(`API error response:`, error_text);
      throw new Error("Falla al recibir preguntas de la encuesta");
    }

    const questions_response_json = await r.json();
    console.log(`Parsed response:`, questions_response_json);
    const questions_response = schema.QuestionsResponse2.safeParse(questions_response_json);
    if (!questions_response.success) {
      console.error(`Schema validation error:`, questions_response.error);
      throw new Error(
        `Falla al procesar preguntas de la encuesta.
        Error: ${questions_response.error}
        Got this response: ${JSON.stringify(questions_response_json)}`,
      );
    }

    console.log(`Successfully loaded questions for survey: ${survey_id}`);
    setAnswersData(makeAnswersData(questions_response.data.questions));

    return questions_response.data;
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
      const error_json = await r.json();
      const error_payload = JSON.parse(error_json.payload.message);
      console.error("Falla al subir tus respuestas.", error_payload);
    }
    if (failed) throw new Error("Falla al subir tus respuestas.");

    navigate("/survey/success");
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
          if ("question_option_id" in answer) {
            if (answer.question_option_id === -1) return false;
          } else if ("question_option_ids" in answer) {
            if (answer.question_option_ids.length === 0) return false;
          }
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
    // TODO: Check better, for now just send incomplete answers
    // if (!checkedAllAnswers()) {
    //   setStatus({ status: "error", message: "Todavia hay preguntas sin responder" });
    //   return;
    // }
    setStatus({ status: "submitting" });
    console.debug(`submitting ${JSON.stringify(answers_data)}`);
    const submit_request = processAnswersData(answers_data);
    setSubmitPayload(submit_request);
  };

  //### Render

  return (
    <main class="app-shell">
      <DisplayStatusBlock status={getStatus()} />
      <Suspense fallback={<LoadingQuestionsBlock />}>
        <Show when={getQuestionsData.state === "ready"}>
          <section class="hero-card">
            <h1>{getQuestionsData()!.name}</h1>
            <Show when={getQuestionsData()!.description}>
              <p class="eyebrow">{getQuestionsData()!.description}</p>
            </Show>
          </section>

          <QuestionsBodyBlock
            questions={getQuestionsData()!.questions}
            setStatus={setStatus}
            onAnswer={onAnswerSetAnswersData}
          />

          <SubmitButtonBlock onClick={onSubmitSendAnswers} disabled={isSubmitting()} />
        </Show>
        <Show when={getQuestionsData.state === "errored"}>
          <div class="status error">
            <p>Error loading survey: {getQuestionsData.error?.message}</p>
          </div>
        </Show>
      </Suspense>
    </main>
  );
};

const QuestionsBodyBlock = (props: {
  questions: processed.Questions;
  setStatus: Setter<Status | null>;
  onAnswer: (question_id: number, answer_value: schema_type.JsonAnswerValue) => void;
}) => (
  <div>
    <For each={Object.values(props.questions)}>
      {(question) => {
        //### Helpers

        const questionTypeText = () => {
          switch (question.type) {
            case schema.AnswerType.Multiple:
              return (question.max_options ?? 1) > 1 ? "Selección múltiple " : "Opcion";
            case schema.AnswerType.Text:
              return "Texto libre";
            default:
              throw new Error("Programming error: question type not handled");
          }
        };

        //### Events

        const onSelectChoice = (
          option_id: number,
          alternative_text?: string,
        ) => {
          const answer: schema_type.JsonAnswerValue = {
            type: schema.AnswerType.Multiple,
            question_option_id: option_id,
            optional_alternative_text: alternative_text,
          };
          props.onAnswer(question.id, answer);
        };

        const onMultiSelectChoice = (option_ids: number[]) => {
          const answer: schema_type.JsonAnswerValue = {
            type: schema.AnswerType.Multiple,
            question_option_ids: option_ids,
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
              <h2>{question.question}</h2>
              <span class="question-type">{questionTypeText()}</span>
            </div>
            <Show when={question.img_url}>
              <img class="question-image" src={question.img_url!} />
            </Show>
            <Show when={question.body_text}>
              <p class="question-body">{question.body_text}</p>
            </Show>
            <Switch>
              <Match
                when={question.type === schema.AnswerType.Multiple &&
                  (question.max_options ?? 1) === 1}
              >
                <MultipleChoiceBlock
                  choices={(question as processed.QuestionWithOptions).options}
                  onSelectChoice={onSelectChoice}
                />
              </Match>
              <Match
                when={question.type === schema.AnswerType.Multiple &&
                  (question.max_options ?? 1) > 1}
              >
                <MultiSelectBlock
                  choices={(question as processed.QuestionWithOptions).options}
                  max_options={question.max_options ?? 2}
                  onMultiSelectChoice={onMultiSelectChoice}
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
  choices: schema_type.Option[];
  onSelectChoice: (option_id: number, alternative_text?: string) => void;
}) => {
  //### Signals

  const [getSelectedId, setSelectedId] = createSignal<number>(-1);
  const [getAlternativeText, setAlternativeText] = createSignal<string>("");

  createEffect(() => {
    const sn = getSelectedId();
    if (sn !== -1) {
      const selected_option = props.choices.find((o) => o.id === sn);
      const alt_text = selected_option?.is_alternative ? getAlternativeText() : undefined;
      props.onSelectChoice(sn, alt_text);
    }
  });

  createEffect(() => {
    const alt_text = getAlternativeText();
    const sn = getSelectedId();
    const selected_option = props.choices.find((o) => o.id === sn);
    if (selected_option?.is_alternative && sn !== -1) {
      props.onSelectChoice(sn, alt_text);
    }
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
          <div class="option-container">
            <button
              type="button"
              class={buttonStyle(option.id)}
              onClick={() => setSelectedId(option.id)}
            >
              {option.text_value}
            </button>
            <Show when={option.is_alternative && getSelectedId() === option.id}>
              <input
                type="text"
                class="alternative-input"
                placeholder="Please specify..."
                value={getAlternativeText()}
                onInput={(e) => setAlternativeText(e.currentTarget.value)}
              />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};

const MultiSelectBlock = (props: {
  choices: schema_type.Option[];
  max_options: number;
  onMultiSelectChoice: (option_ids: number[]) => void;
}) => {
  //### Signals

  const [getSelectedIds, setSelectedIds] = createSignal<number[]>([]);

  createEffect(() => {
    const ids = getSelectedIds();
    props.onMultiSelectChoice(ids);
  });

  //### Helpers

  const toggleOption = (option_id: number) => {
    const current = getSelectedIds();
    if (current.includes(option_id)) {
      setSelectedIds(current.filter((id) => id !== option_id));
    } else {
      if (current.length < props.max_options) {
        setSelectedIds([...current, option_id]);
      }
    }
  };

  const isSelected = (option_id: number) => {
    return getSelectedIds().includes(option_id);
  };

  const isDisabled = (option_id: number) => {
    return !isSelected(option_id) && getSelectedIds().length >= props.max_options;
  };

  const checkboxStyle = (option_id: number) => {
    if (isDisabled(option_id)) return "checkbox-button disabled";
    if (isSelected(option_id)) return "checkbox-button selected";
    return "checkbox-button";
  };

  //### Render

  return (
    <div class="options-grid">
      <For each={props.choices}>
        {(option) => (
          <div class="option-container">
            <button
              type="button"
              class={checkboxStyle(option.id)}
              onClick={() => !isDisabled(option.id) && toggleOption(option.id)}
              disabled={isDisabled(option.id)}
            >
              <span class="checkbox-indicator">
                {isSelected(option.id) ? "☑" : "☐"}
              </span>
              {option.text_value}
            </button>
          </div>
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
