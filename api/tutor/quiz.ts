import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { generateQuizQuestions } from '../_lib/llm.js';
import { getConcept } from '../_lib/curriculum.js';

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

    const concept = getConcept(subject, conceptId);
    if (!concept) {
      return Response.json({ error: 'Concept not found' }, { status: 400 });
    }

    const quizJson = await generateQuizQuestions(
      subject,
      concept.name,
      userResult.rows[0].grade_level,
      5
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
