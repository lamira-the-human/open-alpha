import { executeSql } from '../../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../../_lib/auth.js';

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
  last_attempt_at: string;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const result = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, last_attempt_at
       FROM progress
       WHERE student_id = $1 AND last_attempt_at IS NOT NULL
       ORDER BY last_attempt_at DESC
       LIMIT 10`,
      [auth.userId]
    );

    return Response.json({ recentProgress: result.rows });
  } catch (error) {
    console.error('Get recent activity error:', error);
    return Response.json({ error: 'Failed to get recent activity' }, { status: 500 });
  }
}
