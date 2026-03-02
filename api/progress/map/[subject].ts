import { executeSql } from '../../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../../_lib/auth.js';
import { getSubject } from '../../_lib/curriculum.js';

interface ProgressRow {
  concept_id: string;
  mastery_score: number;
  last_attempt_at: string | null;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const subjectId = pathParts[pathParts.length - 1];

    const subject = getSubject(subjectId);
    if (!subject) {
      return Response.json({ error: 'Subject not found' }, { status: 404 });
    }

    const progressResult = await executeSql<ProgressRow>(
      `SELECT concept_id, mastery_score, last_attempt_at
       FROM progress
       WHERE student_id = $1 AND subject = $2`,
      [auth.userId, subjectId]
    );

    const progressMap = new Map(progressResult.rows.map(p => [p.concept_id, p]));

    const concepts = subject.concepts.map(concept => {
      const progress = progressMap.get(concept.id);
      return {
        id: concept.id,
        name: concept.name,
        gradeLevel: concept.gradeLevel,
        prerequisites: concept.prerequisites,
        masteryScore: progress?.mastery_score ?? 0,
        lastAttemptAt: progress?.last_attempt_at ?? null,
      };
    });

    return Response.json({
      subjectId: subject.id,
      subjectName: subject.name,
      concepts,
    });
  } catch (error) {
    console.error('Get concept map error:', error);
    return Response.json({ error: 'Failed to load concept map' }, { status: 500 });
  }
}
