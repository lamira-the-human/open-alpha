/**
 * POST /api/demo/chat
 *
 * Demo mode chat — no account required.
 * Lets anyone try the AI tutor instantly without signing up.
 * Limited to 20 messages per guest session to balance access and cost.
 *
 * Request body:
 * {
 *   message: string,
 *   subject: string,
 *   conceptId: string,
 *   gradeLevel?: number,    // defaults to 9 (freshman)
 *   sessionId?: string      // returned from first message, pass back to continue conversation
 * }
 *
 * First call: omit sessionId → returns a new sessionId for the guest
 * Subsequent calls: include sessionId → continues conversation
 * After 20 messages: returns { limitReached: true, signupUrl: '/signup' }
 *
 * Sessions expire after 24 hours. Progress is not saved — to save progress,
 * the user must create an account.
 */

import { executeSql } from '../_lib/db.js';
import { chatWithTutor, ChatMessage, TutorContext } from '../_lib/llm.js';
import { getConceptWithLesson } from '../_lib/curriculum.js';

const DEMO_MESSAGE_LIMIT = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateSessionId(): string {
  return 'demo_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hashIp(ip: string): string {
  // Simple hash — enough to track rate limits without storing real IPs
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

interface DemoSession {
  id: string;
  subject: string;
  concept_id: string;
  grade_level: number;
  messages: string;
  message_count: number;
}

export async function POST(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json() as {
      message: string;
      subject: string;
      conceptId: string;
      gradeLevel?: number;
      sessionId?: string;
    };

    const { message, subject, conceptId, gradeLevel = 9, sessionId } = body;

    if (!message || !subject || !conceptId) {
      return Response.json(
        { error: 'message, subject, and conceptId are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const concept = await getConceptWithLesson(subject, conceptId);
    if (!concept) {
      return Response.json(
        { error: `Concept '${conceptId}' not found in subject '${subject}'` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Get or create guest session
    let session: DemoSession;

    if (sessionId) {
      const existing = await executeSql<DemoSession>(
        `SELECT id, subject, concept_id, grade_level, messages, message_count
         FROM guest_sessions
         WHERE id = $1 AND created_at > datetime('now', '-1 day')`,
        [sessionId]
      );

      if (existing.rows.length === 0) {
        return Response.json(
          { error: 'Session expired or not found. Start a new demo session by omitting sessionId.' },
          { status: 404, headers: CORS_HEADERS }
        );
      }

      session = existing.rows[0];
    } else {
      // Rate limit: max 3 new demo sessions per IP per hour
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipHash = hashIp(clientIp);

      const recentSessions = await executeSql<{ count: number }>(
        `SELECT COUNT(*) as count FROM guest_sessions
         WHERE ip_hash = $1 AND created_at > datetime('now', '-1 hour')`,
        [ipHash]
      );

      if (Number(recentSessions.rows[0]?.count) >= 5) {
        return Response.json(
          {
            error: 'Too many demo sessions from your network. Please sign up for a free account to continue learning.',
            signupUrl: '/signup',
          },
          { status: 429, headers: CORS_HEADERS }
        );
      }

      const newId = generateSessionId();
      await executeSql(
        `INSERT INTO guest_sessions (id, subject, concept_id, grade_level, messages, message_count, ip_hash)
         VALUES ($1, $2, $3, $4, '[]', 0, $5)`,
        [newId, subject, conceptId, gradeLevel, ipHash]
      );

      session = {
        id: newId,
        subject,
        concept_id: conceptId,
        grade_level: gradeLevel,
        messages: '[]',
        message_count: 0,
      };
    }

    // Check message limit
    const messageCount = Number(session.message_count);
    if (messageCount >= DEMO_MESSAGE_LIMIT) {
      return Response.json(
        {
          limitReached: true,
          messagesUsed: messageCount,
          limit: DEMO_MESSAGE_LIMIT,
          message: `You've reached the ${DEMO_MESSAGE_LIMIT}-message demo limit. Create a free account to keep learning with no limits!`,
          signupUrl: '/signup',
          signupBenefits: [
            'Unlimited tutoring conversations',
            'Progress tracking across all subjects',
            'Mastery quizzes and achievement tracking',
            'Parent oversight tools',
          ],
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Build chat messages
    const messages: ChatMessage[] = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    messages.push({ role: 'user', content: message });

    // Build tutor context
    const workedExamplesText = concept.workedExamples
      ?.map((ex, i) =>
        `Example ${i + 1}: ${ex.problem}\n${ex.steps.map((s, j) => `  Step ${j + 1}: ${s}`).join('\n')}\nAnswer: ${ex.answer}`
      )
      .join('\n\n');

    const context: TutorContext = {
      gradeLevel: session.grade_level,
      subject,
      conceptName: concept.name,
      conceptDescription: concept.description,
      progressContext: 'Demo session — no prior progress tracked.',
      storedExplanation: concept.explanation?.text,
      workedExamplesText,
      whyItMatters: concept.whyItMatters,
    };

    const aiResponse = await chatWithTutor(messages, context);
    messages.push({ role: 'assistant', content: aiResponse });

    const newCount = messageCount + 1;

    // Update session
    await executeSql(
      `UPDATE guest_sessions SET messages = $1, message_count = $2, updated_at = datetime('now') WHERE id = $3`,
      [JSON.stringify(messages), newCount, session.id]
    );

    const remaining = DEMO_MESSAGE_LIMIT - newCount;

    return Response.json(
      {
        sessionId: session.id,
        response: aiResponse,
        messages,
        messagesUsed: newCount,
        messagesRemaining: remaining,
        limitReached: false,
        ...(remaining <= 5 && {
          nudge: `You have ${remaining} message${remaining === 1 ? '' : 's'} left in demo mode. Sign up free to keep going!`,
          signupUrl: '/signup',
        }),
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Demo chat error:', error);
    return Response.json(
      { error: 'Failed to chat with tutor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
