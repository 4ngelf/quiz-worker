//! Script to load survey data from YAML file into the database
//! Usage: deno -A scripts/load_survey.ts <path_to_survey.yaml> <survey_id> <question_id> <option_id>
//! Example: deno -A scripts/load_survey.ts actual_surveys/1.yaml 1 1 1

import { parse as parseYaml } from "std/yaml";
import * as schema from "@worker/schema.ts";

// Type interfaces for the YAML survey structure
interface SurveyOption {
  text_value: string;
  is_alternative?: boolean;
  img_url?: string | null;
}

interface SurveyQuestion {
  type: "text" | "multiple";
  question: string;
  body_text?: string | null;
  img_url?: string | null;
  max_options?: number;
  options?: SurveyOption[];
}

interface SurveyData {
  name: string;
  description: string;
  questions: SurveyQuestion[];
}

interface IDConfig {
  survey_id: number;
  question_id: number;
  option_id: number;
}

// Parse command-line arguments for IDs
const getIDConfig = (args: string[]): IDConfig => {
  if (args.length < 3) {
    console.error(
      "Usage: deno -A scripts/load_survey.ts <path_to_survey.yaml> <survey_id> <question_id> <option_id>",
    );
    console.error("Example: deno -A scripts/load_survey.ts actual_surveys/1.yaml 1 1 1");
    Deno.exit(1);
  }

  const survey_id = parseInt(args[0], 10);
  const question_id = parseInt(args[1], 10);
  const option_id = parseInt(args[2], 10);

  if (isNaN(survey_id) || isNaN(question_id) || isNaN(option_id)) {
    throw new Error("All IDs must be valid numbers");
  }

  console.log(`Using IDs: survey=${survey_id}, question=${question_id}, option=${option_id}\n`);

  return { survey_id, question_id, option_id };
};

// Escape SQL string values
const escapeSqlString = (str: string | null | undefined): string => {
  if (str === null || str === undefined) return "NULL";
  return "'" + str.replace(/'/g, "''") + "'";
};

// Convert boolean to SQL integer (0 or 1)
const boolToSqlInt = (val: boolean | undefined): number => {
  return val === true ? 1 : 0;
};

// Map question type string to answer type integer
const mapQuestionType = (type: string): number => {
  const typeMap: Record<string, number> = {
    text: schema.AnswerType.Text,
    multiple: schema.AnswerType.Multiple,
  };
  return typeMap[type] ?? schema.AnswerType.Text;
};

const main = async () => {
  if (Deno.args.length < 4) {
    console.error(
      "Usage: deno -A scripts/load_survey.ts <path_to_survey.yaml> <survey_id> <question_id> <option_id>",
    );
    console.error("Example: deno -A scripts/load_survey.ts actual_surveys/1.yaml 1 1 1");
    Deno.exit(1);
  }

  const yamlPath = Deno.args[0];
  const idArgs = Deno.args.slice(1);

  try {
    // Get ID configuration from command-line arguments
    const ids = getIDConfig(idArgs);
    let currentSurveyId: number = ids.survey_id;
    let currentQuestionId: number = ids.question_id;
    let currentOptionId: number = ids.option_id;

    // Read the YAML file
    console.log(`Reading survey from: ${yamlPath}\n`);
    const yamlContent = await Deno.readTextFile(yamlPath);
    const surveyData = parseYaml(yamlContent) as SurveyData;

    // Validate required fields
    if (!surveyData.name || !surveyData.questions) {
      throw new Error("Survey must have 'name' and 'questions' fields");
    }

    // Generate SQL statements
    const sqlStatements: string[] = [];

    // 1. Insert survey
    const insertSurvey = `INSERT INTO surveys (id, name, description) VALUES (${currentSurveyId}, ${
      escapeSqlString(surveyData.name)
    }, ${escapeSqlString(surveyData.description)});`;
    sqlStatements.push(insertSurvey);

    // 2. Insert questions and options
    for (const question of surveyData.questions) {
      // Map type string to integer using schema
      const questionType = mapQuestionType(question.type);
      const questionText = escapeSqlString(question.question);
      const bodyText = escapeSqlString(question.body_text ?? null);
      const imgUrl = escapeSqlString(question.img_url ?? null);
      const maxOptions = question.max_options ?? 1;

      const insertQuestion =
        `INSERT INTO questions (id, survey_id, type, question, body_text, img_url, max_options) VALUES (${currentQuestionId}, ${currentSurveyId}, ${questionType}, ${questionText}, ${bodyText}, ${imgUrl}, ${maxOptions});`;
      sqlStatements.push(insertQuestion);

      // Insert question options if they exist
      if (question.options && question.options.length > 0) {
        for (let optionIdx = 0; optionIdx < question.options.length; optionIdx++) {
          const option = question.options[optionIdx];
          const optionNumber = optionIdx + 1;
          const isAlternative = boolToSqlInt(option.is_alternative);

          const insertOption =
            `INSERT INTO questions_options (id, question_id, number, text_value, img_url, is_alternative) VALUES (${currentOptionId}, ${currentQuestionId}, ${optionNumber}, ${
              escapeSqlString(option.text_value)
            }, ${escapeSqlString(option.img_url ?? null)}, ${isAlternative});`;
          sqlStatements.push(insertOption);
          currentOptionId++;
        }
      }

      currentQuestionId++;
    }

    // Output all SQL statements
    console.log("-- Generated SQL statements for survey: " + surveyData.name);
    console.log("-- File: " + yamlPath);
    console.log("-- Generated at: " + new Date().toISOString());
    console.log("");
    console.log("BEGIN TRANSACTION;");
    console.log("");

    for (const sql of sqlStatements) {
      console.log(sql);
    }

    console.log("");
    console.log("COMMIT;");
    console.log("");
    console.log(`-- Total statements: ${sqlStatements.length}`);
    console.log(`-- Survey ID: ${currentSurveyId - 1}`);
    console.log(`-- Questions: ${currentQuestionId - ids.question_id}`);
    console.log(`-- Options: ${currentOptionId - ids.option_id}`);
  } catch (error) {
    console.error(
      "Error processing survey file:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
};

main();
