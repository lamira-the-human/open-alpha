import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { executeSql } from '../services/atxp-db.js';
import { subjects } from '../services/curriculum.js';

const router = Router();

const getJwtSecret = () => process.env.JWT_SECRET || 'development-secret-change-in-production';

interface ParentLink {
  id: number;
  parent_id: number;
  student_id: number;
  invite_code: string | null;
  linked_at: string | null;
}

interface User {
  id: number;
  email: string;
  display_name: string | null;
  grade_level: number | null;
}

interface Progress {
  subject: string;
  concept_id: string;
  mastery_score: number;
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

// Validation schemas
const linkCodeSchema = z.object({
  inviteCode: z.string().length(8),
});

// Generate invite code for student
router.post('/generate-invite', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'student') {
      res.status(401).json({ error: 'Not authenticated as student' });
      return;
    }

    // Generate 8-character invite code
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Check if there's an existing pending link
    const existing = await executeSql<ParentLink>(
      'SELECT id FROM parent_links WHERE student_id = $1 AND linked_at IS NULL',
      [auth.userId]
    );

    if (existing.rows.length > 0) {
      // Update existing invite code
      await executeSql(
        'UPDATE parent_links SET invite_code = $1 WHERE student_id = $2 AND linked_at IS NULL',
        [inviteCode, auth.userId]
      );
    } else {
      // Create new pending link
      await executeSql(
        'INSERT INTO parent_links (student_id, invite_code) VALUES ($1, $2)',
        [auth.userId, inviteCode]
      );
    }

    res.json({ inviteCode });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
});

// Parent links to student using invite code
router.post('/link', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const data = linkCodeSchema.parse(req.body);

    // Find pending link with this code
    const linkResult = await executeSql<ParentLink>(
      'SELECT id, student_id FROM parent_links WHERE invite_code = $1 AND linked_at IS NULL',
      [data.inviteCode]
    );

    if (linkResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid or expired invite code' });
      return;
    }

    const link = linkResult.rows[0];

    // Check if already linked
    const existingLink = await executeSql<ParentLink>(
      'SELECT id FROM parent_links WHERE parent_id = $1 AND student_id = $2 AND linked_at IS NOT NULL',
      [auth.userId, link.student_id]
    );

    if (existingLink.rows.length > 0) {
      res.status(400).json({ error: 'Already linked to this student' });
      return;
    }

    // Complete the link
    await executeSql(
      "UPDATE parent_links SET parent_id = $1, linked_at = datetime('now'), invite_code = NULL WHERE id = $2",
      [auth.userId, link.id]
    );

    // Get student info
    const studentResult = await executeSql<User>(
      'SELECT id, display_name, grade_level FROM users WHERE id = $1',
      [link.student_id]
    );

    res.json({
      success: true,
      student: studentResult.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid invite code format' });
      return;
    }
    console.error('Link error:', error);
    res.status(500).json({ error: 'Failed to link accounts' });
  }
});

// Get linked children
router.get('/children', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const result = await executeSql<User & { linked_at: string }>(
      `SELECT u.id, u.email, u.display_name, u.grade_level, pl.linked_at
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

// Get child's progress (read-only for parent)
router.get('/children/:childId/progress', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const childId = parseInt(req.params.childId, 10);

    // Verify parent has access to this child
    const linkResult = await executeSql<{ id: number }>(
      `SELECT id FROM parent_links
       WHERE parent_id = $1 AND student_id = $2 AND linked_at IS NOT NULL`,
      [auth.userId, childId]
    );

    if (linkResult.rows.length === 0) {
      res.status(403).json({ error: 'Not authorized to view this child' });
      return;
    }

    // Get progress
    const progressResult = await executeSql<Progress>(
      `SELECT subject, concept_id, mastery_score, completed_at
       FROM progress
       WHERE student_id = $1`,
      [childId]
    );

    // Calculate summary per subject
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

    res.json({
      progress: progressResult.rows,
      summary,
    });
  } catch (error) {
    console.error('Get child progress error:', error);
    res.status(500).json({ error: 'Failed to get child progress' });
  }
});

// Get child's session history (read-only for parent)
router.get('/children/:childId/sessions', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const childId = parseInt(req.params.childId, 10);

    // Verify parent has access to this child
    const linkResult = await executeSql<{ id: number }>(
      `SELECT id FROM parent_links
       WHERE parent_id = $1 AND student_id = $2 AND linked_at IS NOT NULL`,
      [auth.userId, childId]
    );

    if (linkResult.rows.length === 0) {
      res.status(403).json({ error: 'Not authorized to view this child' });
      return;
    }

    // Get sessions (only metadata, not full messages for privacy)
    const sessionResult = await executeSql<Session>(
      `SELECT id, session_type, subject, concept_id, created_at, updated_at
       FROM sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [childId]
    );

    res.json({ sessions: sessionResult.rows });
  } catch (error) {
    console.error('Get child sessions error:', error);
    res.status(500).json({ error: 'Failed to get child session history' });
  }
});

// Get child's analytics insights
router.get('/children/:childId/analytics', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const childId = parseInt(req.params.childId, 10);

    // Verify parent has access to this child
    const linkResult = await executeSql<{ id: number }>(
      `SELECT id FROM parent_links
       WHERE parent_id = $1 AND student_id = $2 AND linked_at IS NOT NULL`,
      [auth.userId, childId]
    );

    if (linkResult.rows.length === 0) {
      res.status(403).json({ error: 'Not authorized to view this child' });
      return;
    }

    // Get recent activity (last 7 days of sessions)
    const activityResult = await executeSql<{
      session_type: string;
      subject: string | null;
      concept_id: string | null;
      updated_at: string;
    }>(
      `SELECT session_type, subject, concept_id, updated_at
       FROM sessions
       WHERE user_id = $1 AND updated_at >= datetime('now', '-7 days')
       ORDER BY updated_at DESC
       LIMIT 10`,
      [childId]
    );

    // Get struggling concepts (multiple attempts with score < 80)
    const strugglingResult = await executeSql<{
      subject: string;
      concept_id: string;
      mastery_score: number;
      attempts: number;
      last_attempt_at: string;
    }>(
      `SELECT subject, concept_id, mastery_score, attempts, last_attempt_at
       FROM progress
       WHERE student_id = $1 AND mastery_score < 80 AND attempts >= 2
       ORDER BY attempts DESC, mastery_score ASC
       LIMIT 5`,
      [childId]
    );

    // Get all progress for recommendations
    const progressResult = await executeSql<{
      subject: string;
      concept_id: string;
      mastery_score: number;
    }>(
      `SELECT subject, concept_id, mastery_score
       FROM progress
       WHERE student_id = $1`,
      [childId]
    );

    // Generate recommendations based on progress
    const recommendations: Array<{
      type: 'continue' | 'review' | 'start';
      subject: string;
      conceptId: string;
      conceptName: string;
      reason: string;
    }> = [];

    // Find concepts to continue (started but not mastered)
    const inProgress = progressResult.rows.filter(
      p => p.mastery_score > 0 && p.mastery_score < 80
    );
    for (const p of inProgress.slice(0, 2)) {
      const subject = subjects.find(s => s.id === p.subject);
      const concept = subject?.concepts.find(c => c.id === p.concept_id);
      if (concept) {
        recommendations.push({
          type: 'continue',
          subject: p.subject,
          conceptId: p.concept_id,
          conceptName: concept.name,
          reason: `${p.mastery_score}% mastery - almost there!`,
        });
      }
    }

    // Find subjects with no progress to start
    const startedSubjects = new Set(progressResult.rows.map(p => p.subject));
    for (const subject of subjects) {
      if (!startedSubjects.has(subject.id) && recommendations.length < 3) {
        const firstConcept = subject.concepts[0];
        recommendations.push({
          type: 'start',
          subject: subject.id,
          conceptId: firstConcept.id,
          conceptName: firstConcept.name,
          reason: `Start learning ${subject.name}`,
        });
      }
    }

    // Get last active time
    const lastActiveResult = await executeSql<{ updated_at: string }>(
      `SELECT MAX(updated_at) as updated_at FROM sessions WHERE user_id = $1`,
      [childId]
    );

    res.json({
      lastActive: lastActiveResult.rows[0]?.updated_at || null,
      recentActivity: activityResult.rows,
      struggling: strugglingResult.rows.map(s => {
        const subject = subjects.find(sub => sub.id === s.subject);
        const concept = subject?.concepts.find(c => c.id === s.concept_id);
        return {
          ...s,
          conceptName: concept?.name || s.concept_id,
          subjectName: subject?.name || s.subject,
        };
      }),
      recommendations,
    });
  } catch (error) {
    console.error('Get child analytics error:', error);
    res.status(500).json({ error: 'Failed to get child analytics' });
  }
});

// Unlink from child
router.delete('/children/:childId', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'parent') {
      res.status(401).json({ error: 'Not authenticated as parent' });
      return;
    }

    const childId = parseInt(req.params.childId, 10);

    await executeSql(
      'DELETE FROM parent_links WHERE parent_id = $1 AND student_id = $2',
      [auth.userId, childId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Unlink error:', error);
    res.status(500).json({ error: 'Failed to unlink from child' });
  }
});

export default router;
