import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { executeSql } from '../services/atxp-db.js';
import { subjects } from '../services/curriculum.js';

const router = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'development-secret-change-in-production';

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
  attempts: number;
  last_attempt_at: string;
  completed_at: string | null;
}

interface Session {
  id: number;
  session_type: string;
  subject: string | null;
  concept_id: string | null;
  created_at: string;
  updated_at: string;
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

// Get all progress for current student
router.get('/', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, attempts, last_attempt_at, completed_at
       FROM progress
       WHERE student_id = $1
       ORDER BY subject, concept_id`,
      [auth.userId]
    );

    // Group by subject
    const bySubject: Record<string, Progress[]> = {};
    for (const row of result.rows) {
      if (!bySubject[row.subject]) {
        bySubject[row.subject] = [];
      }
      bySubject[row.subject].push(row);
    }

    res.json({ progress: bySubject });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// Get progress summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, completed_at
       FROM progress
       WHERE student_id = $1`,
      [auth.userId]
    );

    // Calculate summary per subject
    const summary = subjects.map(subject => {
      const subjectProgress = result.rows.filter(p => p.subject === subject.id);
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

    res.json({ summary });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to get progress summary' });
  }
});

// Get progress for a specific subject
router.get('/:subject', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { subject } = req.params;

    const result = await executeSql<Progress>(
      `SELECT concept_id, mastery_score, attempts, last_attempt_at, completed_at
       FROM progress
       WHERE student_id = $1 AND subject = $2
       ORDER BY concept_id`,
      [auth.userId, subject]
    );

    res.json({ subject, progress: result.rows });
  } catch (error) {
    console.error('Get subject progress error:', error);
    res.status(500).json({ error: 'Failed to get subject progress' });
  }
});

// Get recent activity
router.get('/activity/recent', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get recent progress updates
    const progressResult = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, last_attempt_at
       FROM progress
       WHERE student_id = $1
       ORDER BY last_attempt_at DESC
       LIMIT 10`,
      [auth.userId]
    );

    // Get recent sessions
    const sessionResult = await executeSql<Session>(
      `SELECT id, session_type, subject, concept_id, created_at, updated_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 10`,
      [auth.userId]
    );

    res.json({
      recentProgress: progressResult.rows,
      recentSessions: sessionResult.rows,
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get recent activity' });
  }
});

export default router;
