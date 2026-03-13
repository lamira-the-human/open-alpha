import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { executeSql } from '../services/atxp-db.js';
import { chatWithCoach, ChatMessage, CoachContext } from '../services/atxp-llm.js';

const router = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'development-secret-change-in-production';

interface User {
  id: number;
  role: string;
}

interface Session {
  id: number;
  user_id: number;
  messages: ChatMessage[];
}

interface ChildInfo {
  student_id: number;
  grade_level: number;
  display_name: string | null;
}

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
  completed_at: string | null;
}

// Auth middleware
function getUser(req: Request): { userId: number; role: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    return jwt.verify(token, getJwtSecret()) as { userId: number; role: string };
  } catch {
    return null;
  }
}

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1),
  childId: z.number(),
  sessionId: z.number().optional(),
});

// Get linked children for parent
router.get('/children', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const result = await executeSql<ChildInfo>(
      `SELECT u.id as student_id, u.grade_level, u.display_name
       FROM parent_links pl
       JOIN users u ON pl.student_id = u.id
       WHERE pl.parent_id = $1 AND pl.linked_at IS NOT NULL`,
      [auth.userId]
    );

    res.json({ children: result.rows });
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Failed to get linked children' });
  }
});

// Chat with parent coach
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const data = chatSchema.parse(req.body);

    // Verify parent has access to this child
    const linkResult = await executeSql<{ id: number }>(
      `SELECT pl.id FROM parent_links pl
       WHERE pl.parent_id = $1 AND pl.student_id = $2 AND pl.linked_at IS NOT NULL`,
      [auth.userId, data.childId]
    );

    if (linkResult.rows.length === 0) {
      res.status(403).json({ error: 'Not authorized to view this child' });
      return;
    }

    // Get child info
    const childResult = await executeSql<{ grade_level: number; display_name: string | null }>(
      'SELECT grade_level, display_name FROM users WHERE id = $1',
      [data.childId]
    );

    if (childResult.rows.length === 0) {
      res.status(404).json({ error: 'Child not found' });
      return;
    }

    const child = childResult.rows[0];

    // Get child's progress summary
    const progressResult = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, completed_at
       FROM progress
       WHERE student_id = $1
       ORDER BY last_attempt_at DESC
       LIMIT 10`,
      [data.childId]
    );

    const progressSummary = progressResult.rows.length > 0
      ? progressResult.rows.map(p =>
          `${p.subject}: ${p.concept_id} (${p.mastery_score}%${p.completed_at ? ', completed' : ''})`
        ).join('; ')
      : 'No progress recorded yet';

    // Get or create session
    let session: Session;
    if (data.sessionId) {
      const sessionResult = await executeSql<Session>(
        'SELECT id, user_id, messages FROM sessions WHERE id = $1 AND user_id = $2',
        [data.sessionId, auth.userId]
      );
      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      session = sessionResult.rows[0];
    } else {
      const newSession = await executeSql<Session>(
        `INSERT INTO sessions (user_id, session_type, messages)
         VALUES ($1, 'coach', '[]')
         RETURNING id, user_id, messages`,
        [auth.userId]
      );
      session = newSession.rows[0];
    }

    // Parse messages from session
    const messages: ChatMessage[] = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    // Add user message
    messages.push({ role: 'user', content: data.message });

    // Get AI response
    const context: CoachContext = {
      childGradeLevel: child.grade_level,
      childProgressSummary: progressSummary,
    };

    const aiResponse = await chatWithCoach(messages, context);

    // Add AI response to messages
    messages.push({ role: 'assistant', content: aiResponse });

    // Update session
    await executeSql(
      `UPDATE sessions SET messages = $1, updated_at = datetime('now') WHERE id = $2`,
      [JSON.stringify(messages), session.id]
    );

    res.json({
      sessionId: session.id,
      response: aiResponse,
      messages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Coach chat error:', error);
    res.status(500).json({ error: 'Failed to chat with coach' });
  }
});

// Get session history
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const result = await executeSql<{ id: number; created_at: string; updated_at: string }>(
      `SELECT id, created_at, updated_at
       FROM sessions
       WHERE user_id = $1 AND session_type = 'coach'
       ORDER BY updated_at DESC
       LIMIT 20`,
      [auth.userId]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

export default router;
