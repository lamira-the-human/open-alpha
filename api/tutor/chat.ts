import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { chatWithTutor, ChatMessage, TutorContext } from '../_lib/llm.js';
import { getConcept } from '../_lib/curriculum.js';

interface User {
  grade_level: number | null;
}

interface Session {
  id: number;
  user_id: number;
  subject: string;
  concept_id: string;
  messages: string;
}

interface Progress {
  concept_id: string;
  mastery_score: number;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const body = await request.json() as {
      message: string;
      subject: string;
      conceptId: string;
      sessionId?: number;
    };
    const { message, subject, conceptId, sessionId } = body;

    if (!message || !subject || !conceptId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      return Response.json({ error: 'Grade level not set' }, { status: 400 });
    }

    const gradeLevel = userResult.rows[0].grade_level;
    const concept = getConcept(subject, conceptId);

    if (!concept) {
      return Response.json({ error: 'Concept not found' }, { status: 400 });
    }

    let session: Session;
    if (sessionId) {
      const sessionResult = await executeSql<Session>(
        'SELECT id, user_id, subject, concept_id, messages FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, auth.userId]
      );
      if (sessionResult.rows.length === 0) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
      session = sessionResult.rows[0];
    } else {
      const newSession = await executeSql<Session>(
        `INSERT INTO sessions (user_id, session_type, subject, concept_id, messages)
         VALUES ($1, 'tutor', $2, $3, '[]')
         RETURNING id, user_id, subject, concept_id, messages`,
        [auth.userId, subject, conceptId]
      );
      session = newSession.rows[0];
    }

    const messages: ChatMessage[] = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    messages.push({ role: 'user', content: message });

    const progressResult = await executeSql<Progress>(
      'SELECT concept_id, mastery_score FROM progress WHERE student_id = $1 AND subject = $2',
      [auth.userId, subject]
    );

    const progressContext = progressResult.rows
      .map(p => `${p.concept_id}: ${p.mastery_score}%`)
      .join(', ') || 'No prior progress';

    const context: TutorContext = {
      gradeLevel,
      subject,
      conceptName: concept.name,
      conceptDescription: concept.description,
      progressContext,
    };

    const aiResponse = await chatWithTutor(messages, context);
    messages.push({ role: 'assistant', content: aiResponse });

    await executeSql(
      `UPDATE sessions SET messages = $1, updated_at = datetime('now') WHERE id = $2`,
      [JSON.stringify(messages), session.id]
    );

    return Response.json({ sessionId: session.id, response: aiResponse, messages });
  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Failed to chat with tutor' }, { status: 500 });
  }
}
