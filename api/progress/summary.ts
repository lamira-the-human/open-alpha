import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { subjects } from '../_lib/curriculum.js';

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const progressResult = await executeSql<Progress>(
      'SELECT subject, concept_id, mastery_score FROM progress WHERE student_id = $1',
      [auth.userId]
    );

    const summary = subjects.map(subject => {
      const subjectProgress = progressResult.rows.filter(p => p.subject === subject.id);
      const completed = subjectProgress.filter(p => p.mastery_score >= 80).length;
      const inProgress = subjectProgress.filter(p => p.mastery_score > 0 && p.mastery_score < 80).length;
      const totalConcepts = subject.concepts.length;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        completed,
        inProgress,
        notStarted: totalConcepts - completed - inProgress,
        totalConcepts,
        percentComplete: Math.round((completed / totalConcepts) * 100),
      };
    });

    return Response.json({ summary });
  } catch (error) {
    console.error('Get progress summary error:', error);
    return Response.json({ error: 'Failed to get progress summary' }, { status: 500 });
  }
}
