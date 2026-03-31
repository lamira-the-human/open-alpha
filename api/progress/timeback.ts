import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface LearningEvent {
  event_type: string;
  payload: string;
  created_at: string;
  concept_id: string;
  subject: string;
}

interface ProgressRow {
  concept_id: string;
  mastery_score: number;
  attempts: number;
}

interface ConceptCount {
  total: number;
}

interface MasteredCount {
  mastered: number;
}

// GET — compute timeback & waste meter stats for today's session
export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const url = new URL(request.url);
    const subject = url.searchParams.get('subject') || null;

    // Get today's learning events
    const eventsResult = await executeSql<LearningEvent>(
      `SELECT event_type, payload, created_at, concept_id, subject
       FROM learning_events
       WHERE student_id = $1
         AND created_at >= date('now')
       ORDER BY created_at ASC`,
      [auth.userId]
    );

    const events = eventsResult.rows;

    // Calculate focus metrics
    let totalLessonTimeMs = 0;
    let totalQuizTimeMs = 0;
    let rapidGuessCount = 0;
    let totalAnswers = 0;
    let correctAnswers = 0;
    let hintRequests = 0;
    let idleTimeouts = 0;
    let conceptsStudiedToday = new Set<string>();

    let lessonStartTime: string | null = null;
    let quizStartTime: string | null = null;

    for (const event of events) {
      conceptsStudiedToday.add(event.concept_id);

      switch (event.event_type) {
        case 'lesson_start':
          lessonStartTime = event.created_at;
          break;
        case 'lesson_end':
          if (lessonStartTime) {
            totalLessonTimeMs += new Date(event.created_at).getTime() - new Date(lessonStartTime).getTime();
            lessonStartTime = null;
          }
          break;
        case 'quiz_start':
          quizStartTime = event.created_at;
          break;
        case 'quiz_answer': {
          totalAnswers++;
          const payload = JSON.parse(event.payload || '{}');
          if (payload.correct) correctAnswers++;
          // Detect rapid guessing: answer within 3 seconds of quiz start or previous answer
          if (payload.responseTimeMs !== undefined && payload.responseTimeMs < 3000) {
            rapidGuessCount++;
          }
          break;
        }
        case 'quiz_complete':
          if (quizStartTime) {
            totalQuizTimeMs += new Date(event.created_at).getTime() - new Date(quizStartTime).getTime();
            quizStartTime = null;
          }
          break;
        case 'hint_request':
          hintRequests++;
          break;
        case 'idle_timeout':
          idleTimeouts++;
          break;
      }
    }

    // Waste score: 0 (perfect focus) to 100 (all waste)
    // Factors: rapid guessing %, idle timeouts, answer accuracy
    let wasteScore = 0;
    if (totalAnswers > 0) {
      const rapidGuessRatio = rapidGuessCount / totalAnswers;
      wasteScore += rapidGuessRatio * 50; // Up to 50 points from rapid guessing
    }
    wasteScore += Math.min(idleTimeouts * 10, 30); // Up to 30 points from idle timeouts
    if (totalAnswers > 0) {
      const incorrectRatio = 1 - (correctAnswers / totalAnswers);
      // Only add waste if accuracy is very low (below 40%) — suggests random guessing
      if (incorrectRatio > 0.6) {
        wasteScore += 20;
      }
    }
    wasteScore = Math.min(Math.round(wasteScore), 100);

    const focusScore = 100 - wasteScore;

    // Timeback calculation: estimate how much time the student has "earned back"
    // by staying focused. Base: 2 hours of academic time per day (Alpha model).
    // Focused work earns timeback at a faster rate.
    const totalActiveTimeMs = totalLessonTimeMs + totalQuizTimeMs;
    const totalActiveMinutes = totalActiveTimeMs / 60000;
    const targetMinutes = 120; // 2-hour academic block

    // Progress toward daily completion (capped at 100%)
    const dailyProgress = Math.min(Math.round((totalActiveMinutes / targetMinutes) * 100), 100);

    // Efficiency multiplier: focused students finish faster → more free time
    const efficiencyMultiplier = focusScore >= 80 ? 1.25 : focusScore >= 60 ? 1.0 : 0.75;
    const effectiveMinutes = Math.round(totalActiveMinutes * efficiencyMultiplier);
    const timebackMinutes = Math.max(0, Math.round(targetMinutes - effectiveMinutes));

    // Subject-level mastery progress
    let subjectProgress = null;
    if (subject) {
      const totalResult = await executeSql<ConceptCount>(
        `SELECT COUNT(*) as total FROM json_each((SELECT json_group_array(json_extract(value, '$.id')) FROM json_each((SELECT concepts FROM (SELECT json_extract(content, '$.concepts') as concepts FROM generated_lessons WHERE subject_id = $1 LIMIT 1)))))`,
        [subject]
      );
      // Simpler query: count progress rows
      const masteredResult = await executeSql<MasteredCount>(
        'SELECT COUNT(*) as mastered FROM progress WHERE student_id = $1 AND subject = $2 AND mastery_score >= 80',
        [auth.userId, subject]
      );
      const totalProgressResult = await executeSql<ConceptCount>(
        'SELECT COUNT(*) as total FROM progress WHERE student_id = $1 AND subject = $2',
        [auth.userId, subject]
      );
      subjectProgress = {
        mastered: masteredResult.rows[0]?.mastered ?? 0,
        total: totalProgressResult.rows[0]?.total ?? 0,
      };
    }

    // Recent accuracy for adaptive difficulty
    const recentProgress = await executeSql<ProgressRow>(
      `SELECT concept_id, mastery_score, attempts FROM progress
       WHERE student_id = $1
       ORDER BY last_attempt_at DESC LIMIT 5`,
      [auth.userId]
    );

    const recentAccuracy = recentProgress.rows.length > 0
      ? Math.round(recentProgress.rows.reduce((sum, p) => sum + p.mastery_score, 0) / recentProgress.rows.length)
      : null;

    return Response.json({
      today: {
        totalActiveMinutes: Math.round(totalActiveMinutes),
        lessonMinutes: Math.round(totalLessonTimeMs / 60000),
        quizMinutes: Math.round(totalQuizTimeMs / 60000),
        conceptsStudied: conceptsStudiedToday.size,
        totalAnswers,
        correctAnswers,
        hintRequests,
      },
      wasteMeter: {
        score: wasteScore,
        focusScore,
        rapidGuessCount,
        idleTimeouts,
      },
      timeback: {
        dailyProgress,
        targetMinutes,
        effectiveMinutes,
        timebackMinutes,
        efficiencyMultiplier,
      },
      recentAccuracy,
      subjectProgress,
    });
  } catch (error) {
    console.error('Timeback stats error:', error);
    return Response.json({ error: 'Failed to compute timeback stats' }, { status: 500 });
  }
}
