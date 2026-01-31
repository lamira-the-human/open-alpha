import { executeSql } from '../../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../../_lib/auth.js';
import { getNextConcept } from '../../_lib/curriculum.js';

interface User {
  grade_level: number | null;
}

interface Progress {
  concept_id: string;
}

export async function GET(request: Request, { params }: { params: { subject: string } }) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return unauthorized();

    const { subject } = params;

    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      return Response.json({ error: 'Grade level not set' }, { status: 400 });
    }

    const progressResult = await executeSql<Progress>(
      'SELECT concept_id FROM progress WHERE student_id = $1 AND subject = $2 AND mastery_score >= 80',
      [auth.userId, subject]
    );

    const completedIds = progressResult.rows.map(p => p.concept_id);
    const nextConcept = getNextConcept(subject, completedIds, userResult.rows[0].grade_level);

    return Response.json({ concept: nextConcept || null });
  } catch (error) {
    console.error('Get next concept error:', error);
    return Response.json({ error: 'Failed to get next concept' }, { status: 500 });
  }
}
