//! Schema for the application
//!
//! Used by the worker and the client

import {
  array,
  boolean,
  literal,
  nullable,
  number,
  object,
  optional,
  pipe,
  positive,
  record,
  string,
  transform,
  xor,
} from "zod/mini";

// Common types

export const Index = number().check(positive());
export const BooleanInt = number().check((ctx) => {
  if (ctx.value !== 0 && ctx.value !== 1) {
    ctx.issues.push({
      code: "invalid_type",
      expected: "0 or 1",
      received: ctx.value,
      message: "Expected a boolean integer (0 or 1)",
      origin: "number",
      input: ctx.value,
    });
  }
});

export const StringIndex = string().check((ctx) => {
  const index = Number(ctx.value);
  if (isNaN(index) || index < 0) {
    ctx.issues.push({
      code: "too_small",
      minimum: 0,
      origin: "string",
      inclusive: true,
      message: "Index cannot be smaller than zero",
      input: ctx.value,
    });
  }
});

export const SuccessResponse = object({
  success: boolean(),
});

//- GET /api
//  Response = SuccessResponse

//- GET /api/admin/start
//  Response = SuccessResponse

//- GET /api/${survey_id}/questions
//  Response = QuestionsResponse

export const Question = object({
  id: Index,
  type: number(),
  question: string(),
  body_text: nullable(string()),
  img_url: nullable(string()),
});

export const QuestionOption = object({
  id: Index,
  question_id: Index,
  number: Index,
  text_value: string(),
  is_alternative: BooleanInt,
  img_url: nullable(string()),
});

export const QuestionsResponse = object({
  questions: record(StringIndex, Question),
  options: record(StringIndex, QuestionOption),
});

export const Question2 = object({
  id: Index,
  type: number(),
  question: string(),
  body_text: nullable(string()),
  img_url: nullable(string()),
  options: optional(array(QuestionOption)),
});

export const QuestionsResponse2 = object({
  name: string(),
  description: nullable(string()),
  questions: record(StringIndex, Question2),
});

//- POST /api/submit
//  Request = SubmitRequest
//  Response = SuccessResponse

export enum AnswerType {
  Text = 0,
  Multiple = 1,
}

export const JsonAnswerForText = object({
  type: literal(AnswerType.Text),
  large: boolean(),
  text: string(),
});

export const JsonAnswerForMultiple = object({
  type: literal(AnswerType.Multiple),
  question_option_id: Index,
  optional_alternative_text: optional(string()),
});

export const JsonAnswer = xor([
  JsonAnswerForText,
  JsonAnswerForMultiple,
]);

export const JsonAnswerFromString = pipe(
  pipe(string(), transform((s) => JSON.parse(s))),
  JsonAnswer,
);

export const SubmitRequest = object({
  date: string(),
  answers: array(object({
    question_id: StringIndex,
    json_answer: string(),
  })),
});
