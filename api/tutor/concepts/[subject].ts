import { executeSql } from '../../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../../_lib/auth.js';
import { getConceptsForGrade } from '../../_lib/curriculum.js';

interface User {
  grade_level: number | null;
}

interface Progress {
  concept_id: string;
  mastery_score: number;
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

    const gradeLevel = userResult.rows[0].grade_level;
    const concepts = getConceptsForGrade(subject, gradeLevel);

    const progressResult = await executeSql<Progress>(
      'SELECT concept_id, mastery_score FROM progress WHERE student_id = $1 AND subject = $2',
      [auth.userId, subject]
    );

    const progressMap = new Map(
      progressResult.rows.map(p => [p.concept_id, p.mastery_score])
    );

    const conceptsWithProgress = concepts.map(c => ({
      ...c,
      masteryScore: progressMap.get(c.id) || 0,
      completed: (progressMap.get(c.id) || 0) >= 80,
    }));

    return Response.json({ concepts: conceptsWithProgress, gradeLevel });
  } catch (error) {
    console.error('Get concepts error:', error);
    return Response.json({ error: 'Failed to get concepts' }, { status: 500 });
  }
}
