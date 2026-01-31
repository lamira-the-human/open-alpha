import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';
import { chatWithCoach, ChatMessage, CoachContext } from '../_lib/llm.js';
import { subjects } from '../_lib/curriculum.js';

interface Child {
  student_id: number;
  grade_level: number;
}

interface Session {
  id: number;
  messages: string;
}

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'parent') return unauthorized();

    const body = await request.json() as { message: string; childId: number; sessionId?: number };
    const { message, childId, sessionId } = body;

    if (!message || !childId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify parent has access to this child
    const linkResult = await executeSql<Child>(
      `SELECT pl.student_id, u.grade_level
       FROM parent_links pl
       JOIN users u ON pl.student_id = u.id
       WHERE pl.parent_id = $1 AND pl.student_id = $2 AND pl.linked_at IS NOT NULL`,
      [auth.userId, childId]
    );

    if (linkResult.rows.length === 0) {
      return Response.json({ error: 'Not authorized to access this child' }, { status: 403 });
    }

    const child = linkResult.rows[0];

    // Get or create session
    let session: Session;
    if (sessionId) {
      const sessionResult = await executeSql<Session>(
        'SELECT id, messages FROM sessions WHERE id = $1 AND user_id = $2',
        [sessionId, auth.userId]
      );
      if (sessionResult.rows.length === 0) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
      session = sessionResult.rows[0];
    } else {
      const newSession = await executeSql<Session>(
        `INSERT INTO sessions (user_id, session_type, messages)
         VALUES ($1, 'coach', '[]')
         RETURNING id, messages`,
        [auth.userId]
      );
      session = newSession.rows[0];
    }

    const messages: ChatMessage[] = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    messages.push({ role: 'user', content: message });

    // Get child's progress for context
    const progressResult = await executeSql<Progress>(
      'SELECT subject, concept_id, mastery_score FROM progress WHERE student_id = $1',
      [childId]
    );

    const progressSummary = subjects.map(subject => {
      const subjectProgress = progressResult.rows.filter(p => p.subject === subject.id);
      const mastered = subjectProgress.filter(p => p.mastery_score >= 80).length;
      return `${subject.name}: ${mastered}/${subject.concepts.length} concepts mastered`;
    }).join('; ');

    const context: CoachContext = {
      childGradeLevel: child.grade_level,
      childProgressSummary: progressSummary || 'No progress yet',
    };

    const aiResponse = await chatWithCoach(messages, context);
    messages.push({ role: 'assistant', content: aiResponse });

    await executeSql(
      `UPDATE sessions SET messages = $1, updated_at = datetime('now') WHERE id = $2`,
      [JSON.stringify(messages), session.id]
    );

    return Response.json({ sessionId: session.id, response: aiResponse, messages });
  } catch (error) {
    console.error('Coach chat error:', error);
    return Response.json({ error: 'Failed to chat with coach' }, { status: 500 });
  }
}
