/**
 * GET /api/quality/review-queue
 *
 * Returns contributions awaiting human or agent review.
 * Open to read — anyone can see what needs reviewing.
 *
 * Query params:
 *   status=pending|auto_validated|all  (default: auto_validated — ready for human sign-off)
 *   subject=algebra1|math|...          (filter by subject)
 *   limit=N                            (default 20, max 100)
 *   contributor_type=agent|human|all   (filter by contributor type)
 */

import { executeSql } from '../_lib/db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache',
};

interface ContributionRow {
  id: number;
  contributor_id: string;
  contributor_type: string;
  contribution_type: string;
  subject_id: string;
  concept_id: string;
  content: string;
  status: string;
  validation_results: string;
  created_at: string;
  total_contributions: number | null;
  approved_contributions: number | null;
  reputation_score: number | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'auto_validated';
  const subjectFilter = url.searchParams.get('subject');
  const contributorTypeFilter = url.searchParams.get('contributor_type');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam || '20', 10), 100);

  try {
    let whereClauses: string[] = [];
    let params: unknown[] = [];
    let paramIndex = 1;

    if (statusFilter !== 'all') {
      whereClauses.push(`c.status = $${paramIndex++}`);
      params.push(statusFilter);
    } else {
      // 'all' returns everything except deployed
      whereClauses.push(`c.status != 'deployed'`);
    }

    if (subjectFilter) {
      whereClauses.push(`c.subject_id = $${paramIndex++}`);
      params.push(subjectFilter);
    }

    if (contributorTypeFilter && contributorTypeFilter !== 'all') {
      whereClauses.push(`c.contributor_type = $${paramIndex++}`);
      params.push(contributorTypeFilter);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // libsql doesn't support LIMIT with params, so add it to the query string
    const rows = await executeSql<ContributionRow>(
      `SELECT
         c.id, c.contributor_id, c.contributor_type, c.contribution_type,
         c.subject_id, c.concept_id, c.content, c.status, c.validation_results, c.created_at,
         r.total_contributions, r.approved_contributions, r.reputation_score
       FROM contributions c
       LEFT JOIN contributor_reputation r ON c.contributor_id = r.contributor_id
       ${whereStr}
       ORDER BY c.created_at DESC
       LIMIT ${limit}`,
      params
    );

    const items = rows.rows.map(row => {
      let content: Record<string, unknown> = {};
      let validationResults: Record<string, unknown> = {};
      try { content = JSON.parse(row.content as string); } catch { /* ignore */ }
      try { validationResults = JSON.parse(row.validation_results as string); } catch { /* ignore */ }

      return {
        id: row.id,
        contributorId: row.contributor_id,
        contributorType: row.contributor_type,
        contributionType: row.contribution_type,
        subjectId: row.subject_id,
        conceptId: row.concept_id,
        status: row.status,
        validationResults,
        createdAt: row.created_at,
        contributorReputation: {
          totalContributions: row.total_contributions || 0,
          approvedContributions: row.approved_contributions || 0,
          reputationScore: row.reputation_score || 0,
        },
        // Include a preview of content (not the full thing) so reviewers know what they're reviewing
        contentPreview: {
          hasExplanation: !!(content.explanation),
          hasWorkedExamples: !!(Array.isArray(content.workedExamples) && content.workedExamples.length > 0),
          hasGuidedPractice: !!(Array.isArray(content.guidedPractice) && content.guidedPractice.length > 0),
          hasMasteryCheck: !!(content.masteryCheck),
          hasQuestions: !!(Array.isArray((content as { questions?: unknown[] }).questions) && (content as { questions?: unknown[] }).questions!.length > 0),
          objectiveSnippet: typeof content.objective === 'string' ? content.objective.substring(0, 100) : null,
        },
        submitReview: `POST /api/quality/review`,
        viewFull: `GET /api/quality/review-queue/${row.id}`,
      };
    });

    // Summary stats
    const statsResult = await executeSql<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM contributions GROUP BY status`
    );
    const stats: Record<string, number> = {};
    for (const row of statsResult.rows) {
      stats[row.status] = Number(row.count);
    }

    return Response.json(
      {
        items,
        returned: items.length,
        queueStats: stats,
        howToReview: {
          approve: 'POST /api/quality/review with { contributionId, decision: "approve", feedback }',
          reject: 'POST /api/quality/review with { contributionId, decision: "reject", feedback }',
          improve: 'POST /api/quality/review with { contributionId, decision: "improve", feedback }',
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Review queue error:', error);
    return Response.json(
      { error: 'Failed to fetch review queue' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
