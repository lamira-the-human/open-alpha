import { executeSql } from '../../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../../_lib/auth.js';

interface Progress {
  mastery_score: number;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const body = await request.json() as { subject: string; conceptId: string; score: number };
    const { subject, conceptId, score } = body;

    if (!subject || !conceptId || score === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingProgress = await executeSql<Progress>(
      'SELECT mastery_score FROM progress WHERE student_id = $1 AND subject = $2 AND concept_id = $3',
      [auth.userId, subject, conceptId]
    );

    if (existingProgress.rows.length > 0) {
      const currentScore = existingProgress.rows[0].mastery_score;
      const newScore = Math.max(currentScore, score);
      const completed = newScore >= 80;

      await executeSql(
        `UPDATE progress SET mastery_score = $1, attempts = attempts + 1, last_attempt_at = datetime('now')${completed ? ", completed_at = datetime('now')" : ''}
         WHERE student_id = $2 AND subject = $3 AND concept_id = $4`,
        [newScore, auth.userId, subject, conceptId]
      );

      return Response.json({
        masteryScore: newScore,
        passed: completed,
        message: completed ? "Congratulations! You've mastered this concept!" : 'Keep practicing to reach 80% mastery.',
      });
    } else {
      const completed = score >= 80;

      await executeSql(
        `INSERT INTO progress (student_id, subject, concept_id, mastery_score, attempts, last_attempt_at${completed ? ', completed_at' : ''})
         VALUES ($1, $2, $3, $4, 1, datetime('now')${completed ? ", datetime('now')" : ''})`,
        [auth.userId, subject, conceptId, score]
      );

      return Response.json({
        masteryScore: score,
        passed: completed,
        message: completed ? "Congratulations! You've mastered this concept!" : 'Keep practicing to reach 80% mastery.',
      });
    }
  } catch (error) {
    console.error('Submit quiz error:', error);
    return Response.json({ error: 'Failed to submit quiz results' }, { status: 500 });
  }
}
