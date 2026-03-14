/**
 * POST /api/contribute/quiz
 *
 * Submit one or more quiz questions for a concept node.
 * Lower barrier than a full lesson module — great for teachers and subject experts
 * who want to contribute individual questions.
 *
 * Accepts an array of quiz items in the request body.
 * Each item must include question, options (3-4), correctAnswer (A/B/C/D), and explanation.
 *
 * Request body:
 * {
 *   conceptId: string,
 *   subjectId: string,
 *   contributorId: string,
 *   contributorType?: 'agent' | 'human' | 'institution',
 *   questions: QuizQuestion[]
 * }
 */

import { executeSql } from '../_lib/db.js';
import { getConcept, getSubject } from '../_lib/curriculum.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  distractorRationale?: Record<string, string>;
  difficultyTag?: 'easy' | 'medium' | 'hard';
  standardsCode?: string;
}

interface QuizBody {
  conceptId: string;
  subjectId: string;
  contributorId: string;
  contributorType?: 'agent' | 'human' | 'institution';
  questions: QuizQuestion[];
}

function validateQuestion(q: QuizQuestion, index: number): string[] {
  const errors: string[] = [];
  if (!q.question || q.question.trim().length < 10) {
    errors.push(`questions[${index}].question must be at least 10 characters`);
  }
  if (!q.options || q.options.length < 3 || q.options.length > 4) {
    errors.push(`questions[${index}].options must have 3 or 4 items`);
  }
  if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
    errors.push(`questions[${index}].correctAnswer must be A, B, C, or D`);
  }
  if (!q.explanation || q.explanation.trim().length < 10) {
    errors.push(`questions[${index}].explanation must be at least 10 characters`);
  }
  // Check options are labeled A) B) C) D)
  if (q.options) {
    const labels = ['A)', 'B)', 'C)', 'D)'];
    for (let i = 0; i < q.options.length; i++) {
      if (!q.options[i].startsWith(labels[i])) {
        errors.push(`questions[${index}].options[${i}] should start with '${labels[i]}'`);
      }
    }
  }
  return errors;
}

export async function POST(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as QuizBody;

    if (!body.conceptId || !body.subjectId || !body.contributorId) {
      return Response.json(
        { error: 'conceptId, subjectId, and contributorId are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
      return Response.json(
        { error: 'questions must be a non-empty array' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (body.questions.length > 20) {
      return Response.json(
        { error: 'Maximum 20 questions per submission' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const subject = getSubject(body.subjectId);
    if (!subject) {
      return Response.json(
        { error: `Subject '${body.subjectId}' not found` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const concept = getConcept(body.subjectId, body.conceptId);
    if (!concept) {
      return Response.json(
        { error: `Concept '${body.conceptId}' not found in subject '${body.subjectId}'` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Validate all questions
    const allErrors: string[] = [];
    for (let i = 0; i < body.questions.length; i++) {
      allErrors.push(...validateQuestion(body.questions[i], i));
    }

    const status = allErrors.length === 0 ? 'auto_validated' : 'pending';

    const result = await executeSql<{ id: number }>(
      `INSERT INTO contributions (contributor_id, contributor_type, contribution_type, subject_id, concept_id, content, status, validation_results)
       VALUES ($1, $2, 'quiz_item', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        body.contributorId,
        body.contributorType || 'human',
        body.subjectId,
        body.conceptId,
        JSON.stringify({ questions: body.questions }),
        status,
        JSON.stringify({ valid: allErrors.length === 0, errors: allErrors, questionCount: body.questions.length }),
      ]
    );

    await executeSql(
      `INSERT INTO contributor_reputation (contributor_id, contributor_type, total_contributions, last_contribution_at)
       VALUES ($1, $2, 1, datetime('now'))
       ON CONFLICT(contributor_id) DO UPDATE SET
         total_contributions = total_contributions + 1,
         last_contribution_at = datetime('now'),
         updated_at = datetime('now')`,
      [body.contributorId, body.contributorType || 'human']
    );

    return Response.json(
      {
        contributionId: result.rows[0].id,
        status,
        questionsSubmitted: body.questions.length,
        validationErrors: allErrors,
        message: allErrors.length === 0
          ? `${body.questions.length} question(s) submitted and validated. Queued for review.`
          : `${body.questions.length} question(s) submitted with ${allErrors.length} validation error(s). Will require human review.`,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Contribute quiz error:', error);
    return Response.json(
      { error: 'Failed to submit quiz contribution' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
