/**
 * POST /api/contribute/lesson
 *
 * Submit a lesson module for a concept node in the curriculum graph.
 * Open to agents and humans — no account required.
 * All submissions enter the review queue and run automated validation.
 *
 * Request body: see curriculum/contribution-schema.json (lessonModule type)
 *
 * The contribution system is deliberately low-friction:
 *   - No signup required — just a stable contributorId
 *   - All content goes into review (never auto-deployed to students)
 *   - Good contributors build reputation; high-rep contributors get faster review
 *   - Automated validation catches obvious errors (bad math, wrong format)
 *
 * For ATXP agents: use your ATXP account ID as contributorId.
 */

import { executeSql } from '../_lib/db.js';
import { getSubject, getConcept } from '../_lib/curriculum.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface LessonBody {
  type: 'lesson_module';
  conceptId: string;
  subjectId: string;
  contributorId: string;
  contributorType?: 'agent' | 'human' | 'institution';
  content: {
    objective?: string;
    explanation?: { text: string; childVersion?: string; adultVersion?: string };
    alternateExplanations?: Array<{ type: string; text: string }>;
    workedExamples?: Array<{ problem: string; steps: string[]; answer: string }>;
    guidedPractice?: Array<{
      id: string;
      prompt: string;
      answer: string;
      hint: string;
      feedback: { correct: string; incorrect: string };
    }>;
    masteryCheck?: {
      passingScore?: number;
      questions: Array<{
        id: string;
        question: string;
        options: string[];
        correctAnswer: string;
        explanation: string;
      }>;
    };
    remediationPath?: { action: string; conceptId?: string; message: string };
    whyItMatters?: string;
    commonMisconceptions?: Array<{ misconception: string; correction: string }>;
  };
  metadata?: {
    standardsAlignment?: Array<{ standard: string; code: string }>;
    gradeBand?: string;
    estimatedMinutes?: number;
    difficulty?: string;
    tags?: string[];
    sourceNotes?: string;
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoScore: number;
}

function validateLessonContent(body: LessonBody): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let autoScore = 0;

  const { content } = body;

  // Required: at least one substantive content field
  const hasAnyContent = content.explanation || content.workedExamples?.length || content.guidedPractice?.length || content.masteryCheck;
  if (!hasAnyContent) {
    errors.push('content must include at least one field: explanation, workedExamples, guidedPractice, or masteryCheck');
  }

  // Validate explanation
  if (content.explanation) {
    if (!content.explanation.text || content.explanation.text.trim().length < 50) {
      errors.push('explanation.text must be at least 50 characters');
    } else {
      autoScore += 20;
    }
  }

  // Validate worked examples
  if (content.workedExamples) {
    if (content.workedExamples.length < 3) {
      warnings.push('workedExamples should have at least 3 examples');
    }
    for (let i = 0; i < content.workedExamples.length; i++) {
      const ex = content.workedExamples[i];
      if (!ex.problem) errors.push(`workedExamples[${i}].problem is required`);
      if (!ex.steps || ex.steps.length === 0) errors.push(`workedExamples[${i}].steps must have at least one step`);
      if (!ex.answer) errors.push(`workedExamples[${i}].answer is required`);
    }
    if (content.workedExamples.length >= 3 && errors.length === 0) autoScore += 20;
  }

  // Validate guided practice
  if (content.guidedPractice) {
    if (content.guidedPractice.length < 5) {
      warnings.push('guidedPractice should have at least 5 items');
    }
    for (let i = 0; i < content.guidedPractice.length; i++) {
      const item = content.guidedPractice[i];
      if (!item.id) errors.push(`guidedPractice[${i}].id is required`);
      if (!item.prompt) errors.push(`guidedPractice[${i}].prompt is required`);
      if (!item.answer) errors.push(`guidedPractice[${i}].answer is required`);
      if (!item.hint) errors.push(`guidedPractice[${i}].hint is required`);
      if (!item.feedback?.correct || !item.feedback?.incorrect) {
        errors.push(`guidedPractice[${i}].feedback must have correct and incorrect fields`);
      }
    }
    if (content.guidedPractice.length >= 5 && errors.length === 0) autoScore += 20;
  }

  // Validate mastery check
  if (content.masteryCheck) {
    const q = content.masteryCheck.questions;
    if (!q || q.length !== 5) {
      errors.push('masteryCheck.questions must have exactly 5 questions');
    } else {
      for (let i = 0; i < q.length; i++) {
        if (!q[i].question) errors.push(`masteryCheck.questions[${i}].question is required`);
        if (!q[i].options || q[i].options.length < 3) errors.push(`masteryCheck.questions[${i}].options must have at least 3 options`);
        if (!['A', 'B', 'C', 'D'].includes(q[i].correctAnswer)) {
          errors.push(`masteryCheck.questions[${i}].correctAnswer must be A, B, C, or D`);
        }
        if (!q[i].explanation) errors.push(`masteryCheck.questions[${i}].explanation is required`);
      }
      if (errors.length === 0) autoScore += 20;
    }
  }

  if (content.objective) autoScore += 10;
  if (content.whyItMatters) autoScore += 10;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    autoScore,
  };
}

export async function POST(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as LessonBody;

    // Basic presence checks
    if (!body.conceptId || !body.subjectId || !body.contributorId) {
      return Response.json(
        { error: 'conceptId, subjectId, and contributorId are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (body.contributorId.trim().length < 3) {
      return Response.json(
        { error: 'contributorId must be at least 3 characters' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Verify the concept exists
    const subject = getSubject(body.subjectId);
    if (!subject) {
      return Response.json(
        { error: `Subject '${body.subjectId}' not found. Check GET /api/curriculum/graph for valid subjects.` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const concept = getConcept(body.subjectId, body.conceptId);
    if (!concept) {
      return Response.json(
        { error: `Concept '${body.conceptId}' not found in subject '${body.subjectId}'.` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (!body.content || typeof body.content !== 'object') {
      return Response.json(
        { error: 'content is required and must be an object' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate content
    const validation = validateLessonContent(body);

    const validationResults = {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      autoScore: validation.autoScore,
      conceptExists: true,
      subjectExists: true,
    };

    const status = validation.valid ? 'auto_validated' : 'pending';

    // Store the contribution
    const result = await executeSql<{ id: number }>(
      `INSERT INTO contributions (contributor_id, contributor_type, contribution_type, subject_id, concept_id, content, status, validation_results)
       VALUES ($1, $2, 'lesson_module', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        body.contributorId,
        body.contributorType || 'human',
        body.subjectId,
        body.conceptId,
        JSON.stringify(body.content),
        status,
        JSON.stringify(validationResults),
      ]
    );

    const contributionId = result.rows[0].id;

    // Update contributor reputation
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
        contributionId,
        status,
        validation: validationResults,
        message: validation.valid
          ? 'Contribution submitted and passed automated validation. Queued for review.'
          : 'Contribution submitted with validation issues. Please review the errors and resubmit or a human reviewer will evaluate it.',
        reviewQueue: '/api/quality/review-queue',
        concept: { id: concept.id, name: concept.name },
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Contribute lesson error:', error);
    return Response.json(
      { error: 'Failed to submit contribution' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
