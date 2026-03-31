import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

// POST — record a learning event for waste meter / timeback tracking
export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const body = await request.json() as {
      subject: string;
      conceptId: string;
      eventType: string;
      payload?: Record<string, unknown>;
    };

    const { subject, conceptId, eventType, payload } = body;

    if (!subject || !conceptId || !eventType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validTypes = ['lesson_start', 'lesson_end', 'quiz_start', 'quiz_answer', 'quiz_complete', 'hint_request', 'idle_timeout'];
    if (!validTypes.includes(eventType)) {
      return Response.json({ error: `Invalid event type: ${eventType}` }, { status: 400 });
    }

    await executeSql(
      `INSERT INTO learning_events (student_id, subject, concept_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [auth.userId, subject, conceptId, eventType, JSON.stringify(payload || {})]
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Record event error:', error);
    return Response.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
