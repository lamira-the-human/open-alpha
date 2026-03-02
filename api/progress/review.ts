import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { getConcept } from '../_lib/curriculum.js';

interface ProgressRow {
  subject: string;
  concept_id: string;
  mastery_score: number;
  last_attempt_at: string;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const result = await executeSql<ProgressRow>(
      `SELECT subject, concept_id, mastery_score, last_attempt_at
       FROM progress
       WHERE student_id = $1
         AND mastery_score >= 80
         AND last_attempt_at < datetime('now', '-7 days')
       ORDER BY last_attempt_at ASC
       LIMIT 5`,
      [auth.userId]
    );

    const review = result.rows.map(row => ({
      subject: row.subject,
      conceptId: row.concept_id,
      conceptName: getConcept(row.subject, row.concept_id)?.name ?? row.concept_id,
      masteryScore: row.mastery_score,
      lastAttemptAt: row.last_attempt_at,
      daysSince: Math.floor(
        (Date.now() - new Date(row.last_attempt_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return Response.json({ review });
  } catch (error) {
    console.error('Get review error:', error);
    return Response.json({ error: 'Failed to get review queue' }, { status: 500 });
  }
}
