/**
 * GET /api/curriculum/gaps
 *
 * Public endpoint — no authentication required.
 * Returns concept nodes that need content, ranked by student demand.
 *
 * This is the agent contributor's entry point:
 *   1. Agent calls GET /api/curriculum/gaps
 *   2. Gets back a ranked list of concepts that need work
 *   3. Picks the top-ranked empty node
 *   4. Generates content using its ATXP-funded inference
 *   5. Submits via POST /api/contribute/lesson
 *
 * A "gap" is any concept node missing one or more enriched fields:
 *   - explanation (the core teaching content)
 *   - workedExamples (step-by-step examples)
 *   - guidedPractice (practice problems with hints)
 *   - masteryCheck (quiz questions)
 *
 * Demand score is based on how many students are attempting this concept
 * (from the progress table) — so agents fill what students actually need.
 */

import { subjects, Concept } from '../_lib/curriculum.js';
import { executeSql } from '../_lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
};

interface DemandRow {
  concept_id: string;
  subject: string;
  attempt_count: number;
}

function getMissingFields(concept: Concept): string[] {
  const missing: string[] = [];
  if (!concept.objective) missing.push('objective');
  if (!concept.explanation) missing.push('explanation');
  if (!concept.workedExamples || concept.workedExamples.length === 0) missing.push('workedExamples');
  if (!concept.guidedPractice || concept.guidedPractice.length === 0) missing.push('guidedPractice');
  if (!concept.masteryCheck) missing.push('masteryCheck');
  if (!concept.whyItMatters) missing.push('whyItMatters');
  if (!concept.remediationPath) missing.push('remediationPath');
  return missing;
}

function getCompletenessScore(concept: Concept): number {
  const fields = ['objective', 'explanation', 'workedExamples', 'guidedPractice', 'masteryCheck', 'whyItMatters'];
  let score = 0;
  if (concept.objective) score++;
  if (concept.explanation) score++;
  if (concept.workedExamples?.length) score++;
  if (concept.guidedPractice?.length) score++;
  if (concept.masteryCheck) score++;
  if (concept.whyItMatters) score++;
  return Math.round((score / fields.length) * 100);
}

export async function GET(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const subjectFilter = url.searchParams.get('subject');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam || '50', 10), 200);
  const minMissing = parseInt(url.searchParams.get('min_missing') || '1', 10);

  try {
    // Fetch student demand data from progress table
    const demandResult = await executeSql<DemandRow>(
      `SELECT concept_id, subject, COUNT(*) as attempt_count
       FROM progress
       GROUP BY concept_id, subject`
    );

    const demandMap = new Map<string, number>();
    for (const row of demandResult.rows) {
      demandMap.set(`${row.subject}:${row.concept_id}`, Number(row.attempt_count));
    }

    const gaps: Array<{
      conceptId: string;
      conceptName: string;
      subjectId: string;
      subjectName: string;
      level: number;
      missing: string[];
      completenessPercent: number;
      demandScore: number;
      priorityScore: number;
      prerequisites: string[];
      metadata?: Record<string, unknown>;
    }> = [];

    const targetSubjects = subjectFilter
      ? subjects.filter(s => s.id === subjectFilter)
      : subjects;

    for (const subject of targetSubjects) {
      for (const concept of subject.concepts) {
        const missing = getMissingFields(concept);
        if (missing.length < minMissing) continue;

        const demandScore = demandMap.get(`${subject.id}:${concept.id}`) || 0;
        const completeness = getCompletenessScore(concept);

        // Priority = demand (students trying this) + inverse of completeness (emptier = higher priority)
        const priorityScore = (demandScore * 10) + (100 - completeness);

        gaps.push({
          conceptId: concept.id,
          conceptName: concept.name,
          subjectId: subject.id,
          subjectName: subject.name,
          level: concept.gradeLevel,
          missing,
          completenessPercent: completeness,
          demandScore,
          priorityScore,
          prerequisites: concept.prerequisites,
          metadata: concept.metadata as Record<string, unknown> | undefined,
        });
      }
    }

    // Sort by priority: highest demand + most incomplete first
    gaps.sort((a, b) => b.priorityScore - a.priorityScore);

    const results = gaps.slice(0, limit);

    return Response.json(
      {
        totalGaps: gaps.length,
        returned: results.length,
        gaps: results,
        howToContribute: {
          schema: '/curriculum/contribution-schema.json',
          submitLesson: 'POST /api/contribute/lesson',
          submitQuiz: 'POST /api/contribute/quiz',
          reviewQueue: 'GET /api/quality/review-queue',
          docs: 'https://github.com/open-alpha/open-alpha/blob/main/CONTRIBUTING.md',
        },
        generated_at: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Gaps error:', error);
    return Response.json(
      { error: 'Failed to compute curriculum gaps' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
