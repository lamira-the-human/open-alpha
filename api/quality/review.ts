/**
 * POST /api/quality/review
 *
 * Submit a review of a pending contribution.
 * Anyone can review — agents, teachers, or community members.
 * When a contribution receives enough approvals (or one trusted reviewer approves),
 * it graduates to 'approved' status and can be deployed to students.
 *
 * Request body:
 * {
 *   contributionId: number,
 *   reviewerId: string,       // stable ID of the reviewer
 *   reviewerType?: 'agent' | 'human' | 'automated',
 *   decision: 'approve' | 'reject' | 'improve',
 *   feedback: string          // required — explain your reasoning
 * }
 *
 * After review:
 *   - 'approve' with 2+ approvals → status becomes 'approved'
 *   - 'reject' with any rejection → status becomes 'rejected' (with feedback for contributor)
 *   - 'improve' → stays in queue but contributor notified of specific improvements needed
 *
 * Reputation effects:
 *   - Approved contributions increase contributor's reputation_score
 *   - Rejected contributions decrease it slightly
 *   - High-reputation contributors' content gets reviewed faster
 */

import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest } from '../_lib/auth.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ReviewBody {
  contributionId: number;
  reviewerId: string;
  reviewerType?: 'agent' | 'human' | 'automated';
  decision: 'approve' | 'reject' | 'improve';
  feedback: string;
}

interface ContributionRow {
  id: number;
  contributor_id: string;
  status: string;
}

interface ReviewCountRow {
  approve_count: number;
  reject_count: number;
}

export async function POST(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as ReviewBody;

    if (!body.contributionId || !body.reviewerId || !body.decision) {
      return Response.json(
        { error: 'contributionId, reviewerId, and decision are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!['approve', 'reject', 'improve'].includes(body.decision)) {
      return Response.json(
        { error: "decision must be 'approve', 'reject', or 'improve'" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!body.feedback || body.feedback.trim().length < 10) {
      return Response.json(
        { error: 'feedback is required and must be at least 10 characters — explain your reasoning' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Fetch the contribution
    const contribResult = await executeSql<ContributionRow>(
      `SELECT id, contributor_id, status FROM contributions WHERE id = $1`,
      [body.contributionId]
    );

    if (contribResult.rows.length === 0) {
      return Response.json(
        { error: `Contribution ${body.contributionId} not found` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const contribution = contribResult.rows[0];

    if (contribution.status === 'deployed') {
      return Response.json(
        { error: 'This contribution is already deployed and cannot be reviewed' },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Prevent self-review
    if (contribution.contributor_id === body.reviewerId) {
      return Response.json(
        { error: 'Contributors cannot review their own submissions' },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Check for duplicate review from same reviewer
    const existingReview = await executeSql<{ id: number }>(
      `SELECT id FROM contribution_reviews WHERE contribution_id = $1 AND reviewer_id = $2`,
      [body.contributionId, body.reviewerId]
    );

    if (existingReview.rows.length > 0) {
      return Response.json(
        { error: 'You have already reviewed this contribution' },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Record the review
    await executeSql(
      `INSERT INTO contribution_reviews (contribution_id, reviewer_id, reviewer_type, decision, feedback)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        body.contributionId,
        body.reviewerId,
        body.reviewerType || 'human',
        body.decision,
        body.feedback,
      ]
    );

    // Tally votes and update contribution status
    const tally = await executeSql<ReviewCountRow>(
      `SELECT
         SUM(CASE WHEN decision = 'approve' THEN 1 ELSE 0 END) as approve_count,
         SUM(CASE WHEN decision = 'reject' THEN 1 ELSE 0 END) as reject_count
       FROM contribution_reviews
       WHERE contribution_id = $1`,
      [body.contributionId]
    );

    const approveCount = Number(tally.rows[0]?.approve_count || 0);
    const rejectCount = Number(tally.rows[0]?.reject_count || 0);

    let newStatus = contribution.status;
    let reputationDelta = 0;

    // Decision logic:
    // - 1 rejection → rejected (education content errors are serious)
    // - 2 approvals → approved (conservative threshold for initial system)
    // - Improve → stays in queue but logged
    if (body.decision === 'reject' || rejectCount >= 1) {
      newStatus = 'rejected';
      reputationDelta = -5;
    } else if (approveCount >= 2) {
      newStatus = 'approved';
      reputationDelta = +10;
    }

    if (newStatus !== contribution.status) {
      await executeSql(
        `UPDATE contributions SET status = $1, updated_at = datetime('now') WHERE id = $2`,
        [newStatus, body.contributionId]
      );

      // Update contributor reputation
      if (reputationDelta !== 0) {
        const approvedDelta = reputationDelta > 0 ? 1 : 0;
        const rejectedDelta = reputationDelta < 0 ? 1 : 0;
        await executeSql(
          `UPDATE contributor_reputation SET
             reputation_score = MAX(0, reputation_score + $1),
             approved_contributions = approved_contributions + $2,
             rejected_contributions = rejected_contributions + $3,
             updated_at = datetime('now')
           WHERE contributor_id = $4`,
          [reputationDelta, approvedDelta, rejectedDelta, contribution.contributor_id]
        );
      }
    }

    return Response.json(
      {
        reviewRecorded: true,
        contributionId: body.contributionId,
        yourDecision: body.decision,
        newStatus,
        votesSoFar: { approve: approveCount, reject: rejectCount },
        message: newStatus === 'approved'
          ? 'Contribution approved! It will be deployed to students in the next update.'
          : newStatus === 'rejected'
          ? 'Contribution rejected. The contributor has been notified with your feedback.'
          : 'Review recorded. Contribution remains in queue pending more reviews.',
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Review error:', error);
    return Response.json(
      { error: 'Failed to submit review' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
