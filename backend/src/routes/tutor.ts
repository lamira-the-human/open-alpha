import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { executeSql } from '../services/atxp-db.js';
import { chatWithTutor, generateQuizQuestions, ChatMessage, TutorContext } from '../services/atxp-llm.js';
import { getConcept, getConceptsForGrade, getNextConcept } from '../services/curriculum.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

interface User {
  id: number;
  role: string;
  grade_level: number | null;
}

interface Session {
  id: number;
  user_id: number;
  subject: string;
  concept_id: string;
  messages: ChatMessage[];
}

interface Progress {
  concept_id: string;
  mastery_score: number;
}

// Auth middleware
function getUser(req: Request): { userId: number; role: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    return null;
  }
}

// Validation schemas
const chatSchema = z.object({
  message: z.string().min(1),
  subject: z.string(),
  conceptId: z.string(),
  sessionId: z.number().optional(),
});

const quizSchema = z.object({
  subject: z.string(),
  conceptId: z.string(),
});

const submitQuizSchema = z.object({
  subject: z.string(),
  conceptId: z.string(),
  score: z.number().min(0).max(100),
  totalQuestions: z.number().min(1),
  correctAnswers: z.number().min(0),
});

// Get available concepts for student
router.get('/concepts/:subject', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { subject } = req.params;

    // Get student's grade level
    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      res.status(400).json({ error: 'Grade level not set' });
      return;
    }

    const gradeLevel = userResult.rows[0].grade_level;
    const concepts = getConceptsForGrade(subject, gradeLevel);

    // Get student's progress
    const progressResult = await executeSql<Progress>(
      'SELECT concept_id, mastery_score FROM progress WHERE student_id = $1 AND subject = $2',
      [auth.userId, subject]
    );

    const progressMap = new Map(
      progressResult.rows.map(p => [p.concept_id, p.mastery_score])
    );

    const conceptsWithProgress = concepts.map(c => ({
      ...c,
      masteryScore: progressMap.get(c.id) || 0,
      completed: (progressMap.get(c.id) || 0) >= 80,
    }));

    res.json({ concepts: conceptsWithProgress, gradeLevel });
  } catch (error) {
    console.error('Get concepts error:', error);
    res.status(500).json({ error: 'Failed to get concepts' });
  }
});

// Get next recommended concept
router.get('/next/:subject', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { subject } = req.params;

    // Get student info
    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      res.status(400).json({ error: 'Grade level not set' });
      return;
    }

    // Get completed concepts
    const progressResult = await executeSql<Progress>(
      'SELECT concept_id FROM progress WHERE student_id = $1 AND subject = $2 AND mastery_score >= 80',
      [auth.userId, subject]
    );

    const completedIds = progressResult.rows.map(p => p.concept_id);
    const nextConcept = getNextConcept(subject, completedIds, userResult.rows[0].grade_level);

    res.json({ concept: nextConcept || null });
  } catch (error) {
    console.error('Get next concept error:', error);
    res.status(500).json({ error: 'Failed to get next concept' });
  }
});

// Chat with tutor
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'student') {
      res.status(401).json({ error: 'Not authenticated as student' });
      return;
    }

    const data = chatSchema.parse(req.body);

    // Get student info
    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      res.status(400).json({ error: 'Grade level not set' });
      return;
    }

    const gradeLevel = userResult.rows[0].grade_level;

    // Get concept info
    const concept = getConcept(data.subject, data.conceptId);
    if (!concept) {
      res.status(400).json({ error: 'Concept not found' });
      return;
    }

    // Get or create session
    let session: Session;
    if (data.sessionId) {
      const sessionResult = await executeSql<Session>(
        'SELECT id, user_id, subject, concept_id, messages FROM sessions WHERE id = $1 AND user_id = $2',
        [data.sessionId, auth.userId]
      );
      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      session = sessionResult.rows[0];
    } else {
      const newSession = await executeSql<Session>(
        `INSERT INTO sessions (user_id, session_type, subject, concept_id, messages)
         VALUES ($1, 'tutor', $2, $3, '[]')
         RETURNING id, user_id, subject, concept_id, messages`,
        [auth.userId, data.subject, data.conceptId]
      );
      session = newSession.rows[0];
    }

    // Parse messages from session
    const messages: ChatMessage[] = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    // Add user message
    messages.push({ role: 'user', content: data.message });

    // Get progress context
    const progressResult = await executeSql<Progress>(
      'SELECT concept_id, mastery_score FROM progress WHERE student_id = $1 AND subject = $2',
      [auth.userId, data.subject]
    );

    const progressContext = progressResult.rows
      .map(p => `${p.concept_id}: ${p.mastery_score}%`)
      .join(', ') || 'No prior progress';

    // Get AI response
    const context: TutorContext = {
      gradeLevel,
      subject: data.subject,
      conceptName: concept.name,
      conceptDescription: concept.description,
      progressContext,
    };

    const aiResponse = await chatWithTutor(messages, context);

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
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to chat with tutor' });
  }
});

// Generate quiz
router.post('/quiz', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'student') {
      res.status(401).json({ error: 'Not authenticated as student' });
      return;
    }

    const data = quizSchema.parse(req.body);

    // Get student info
    const userResult = await executeSql<User>(
      'SELECT grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].grade_level === null) {
      res.status(400).json({ error: 'Grade level not set' });
      return;
    }

    const concept = getConcept(data.subject, data.conceptId);
    if (!concept) {
      res.status(400).json({ error: 'Concept not found' });
      return;
    }

    const quizJson = await generateQuizQuestions(
      data.subject,
      concept.name,
      userResult.rows[0].grade_level,
      5
    );

    console.log('[Quiz] Raw LLM response:', quizJson.substring(0, 500));

    // Parse and return quiz
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = quizJson;
      const jsonMatch = quizJson.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const quiz = JSON.parse(jsonStr);
      res.json(quiz);
    } catch (parseError) {
      console.error('[Quiz] Parse error:', parseError);
      console.error('[Quiz] Failed to parse:', quizJson.substring(0, 200));
      res.status(500).json({ error: 'Failed to generate quiz' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// Submit quiz results
router.post('/quiz/submit', async (req: Request, res: Response) => {
  try {
    const auth = getUser(req);
    if (!auth || auth.role !== 'student') {
      res.status(401).json({ error: 'Not authenticated as student' });
      return;
    }

    const data = submitQuizSchema.parse(req.body);

    // Update progress
    const existingProgress = await executeSql<Progress>(
      'SELECT mastery_score FROM progress WHERE student_id = $1 AND subject = $2 AND concept_id = $3',
      [auth.userId, data.subject, data.conceptId]
    );

    if (existingProgress.rows.length > 0) {
      // Update existing progress - keep highest score
      const currentScore = existingProgress.rows[0].mastery_score;
      const newScore = Math.max(currentScore, data.score);
      const completed = newScore >= 80;

      await executeSql(
        `UPDATE progress SET mastery_score = $1, attempts = attempts + 1, last_attempt_at = datetime('now')${completed ? ", completed_at = datetime('now')" : ''}
         WHERE student_id = $2 AND subject = $3 AND concept_id = $4`,
        [newScore, auth.userId, data.subject, data.conceptId]
      );

      res.json({
        masteryScore: newScore,
        passed: completed,
        message: completed ? 'Congratulations! You\'ve mastered this concept!' : 'Keep practicing to reach 80% mastery.',
      });
    } else {
      // Insert new progress
      const completed = data.score >= 80;

      await executeSql(
        `INSERT INTO progress (student_id, subject, concept_id, mastery_score, attempts, last_attempt_at${completed ? ', completed_at' : ''})
         VALUES ($1, $2, $3, $4, 1, datetime('now')${completed ? ", datetime('now')" : ''})`,
        [auth.userId, data.subject, data.conceptId, data.score]
      );

      res.json({
        masteryScore: data.score,
        passed: completed,
        message: completed ? 'Congratulations! You\'ve mastered this concept!' : 'Keep practicing to reach 80% mastery.',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Failed to submit quiz results' });
  }
});

export default router;
