//- Modules

import {
	boolean,
	string,
	number,
	array,
	object,
	record,
	literal,
	xor,
	nullable,
	positive,
	pipe,
	transform,
} from "zod/mini";

// Common types

export const Index = number().check(positive());

export const IndexFromString = pipe(pipe(string(), transform(Number)), Index);

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
	img_url: nullable(string()),
});

export const QuestionsResponse = object({
	questions: record(IndexFromString, Question),
	options: record(IndexFromString, QuestionOption),
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
});

export const JsonAnswer = xor([
	JsonAnswerForText,
	JsonAnswerForMultiple
]);

export const JsonAnswerFromString = pipe(
	pipe(string(), transform((s) => JSON.parse(s))),
	JsonAnswer
);

export const Answer = object({
	question_id: Index,
	json_answer: string(),
});

export const AnswerArray = array(Answer);

export const SubmitRequest = object({
	date: string(),
	answers: AnswerArray,
});