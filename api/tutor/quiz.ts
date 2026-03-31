import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { generateQuizQuestions } from '../_lib/llm.js';
import { getConceptWithLesson } from '../_lib/curriculum.js';

interface User {
  grade_level: number | null;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const body = await request.json() as { subject: string; conceptId: string };
    const { subject, conceptId } = body;

    if (!subject || !conceptId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      return Response.json({ error: 'Grade level not set' }, { status: 400 });
    }

    const concept = await getConceptWithLesson(subject, conceptId);
    if (!concept) {
      return Response.json({ error: 'Concept not found' }, { status: 400 });
    }

    // If the concept has stored mastery check questions, use them directly.
    // This avoids LLM generation costs and ensures curriculum alignment.
    if (concept.masteryCheck?.questions?.length === 5) {
      const questions = concept.masteryCheck.questions.map(({ id: _id, ...q }) => q);
      return Response.json({ questions });
    }

    // Fetch student interests for personalized quiz framing
    const interestResult = await executeSql<{ category: string; value: string }>(
      'SELECT category, value FROM user_interests WHERE user_id = $1 ORDER BY weight DESC',
      [auth.userId]
    );
    const interests = interestResult.rows.length > 0 ? interestResult.rows : undefined;

    // Get recent accuracy for adaptive difficulty targeting 80-85% success rate
    const recentResult = await executeSql<{ mastery_score: number }>(
      'SELECT mastery_score FROM progress WHERE student_id = $1 ORDER BY last_attempt_at DESC LIMIT 5',
      [auth.userId]
    );
    const recentAccuracy = recentResult.rows.length > 0
      ? Math.round(recentResult.rows.reduce((sum, p) => sum + p.mastery_score, 0) / recentResult.rows.length)
      : undefined;

    const quizJson = await generateQuizQuestions(
      subject,
      concept.name,
      userResult.rows[0].grade_level,
      5,
      interests,
      recentAccuracy
    );

    // Extract JSON from markdown code blocks if present
    let jsonStr = quizJson;
    const jsonMatch = quizJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const quiz = JSON.parse(jsonStr);
    return Response.json(quiz);
  } catch (error) {
    console.error('Quiz generation error:', error);
    return Response.json({ error: 'Failed to generate quiz' }, { status: 500 });
  }
}
