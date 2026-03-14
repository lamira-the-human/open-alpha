import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { executeSql } from './db.js';

// ── Enriched content types ────────────────────────────────────────────────────

export interface ConceptExplanation {
  text: string;
  childVersion?: string;
  adultVersion?: string;
}

export interface AlternateExplanation {
  type: 'visual' | 'analogy' | 'realWorld' | 'stepByStep' | 'formal';
  text: string;
}

export interface WorkedExample {
  problem: string;
  steps: string[];
  answer: string;
}

export interface GuidedPracticeItem {
  id: string;
  prompt: string;
  answer: string;
  hint: string;
  feedback: {
    correct: string;
    incorrect: string;
  };
}

export interface MasteryQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface MasteryCheck {
  passingScore: number;
  questions: MasteryQuestion[];
}

export interface RemediationPath {
  action: 'review_prerequisites' | 'simpler_explanation' | 'sub_skill' | 'extra_practice';
  conceptId?: string;
  message: string;
}

export interface ConceptMetadata {
  tags?: string[];
  estimatedMinutes?: number;
  gradeBand?: string;
  difficulty?: 'foundational' | 'standard' | 'advanced';
}

// ── Core types ────────────────────────────────────────────────────────────────

export interface Concept {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  gradeLevel: number;
  // Enriched fields — present only on fully-built concept bundles
  objective?: string;
  explanation?: ConceptExplanation;
  alternateExplanations?: AlternateExplanation[];
  workedExamples?: WorkedExample[];
  guidedPractice?: GuidedPracticeItem[];
  masteryCheck?: MasteryCheck;
  remediationPath?: RemediationPath;
  whyItMatters?: string;
  metadata?: ConceptMetadata;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  concepts: Concept[];
}

// ── Loader ────────────────────────────────────────────────────────────────────

function loadSubjects(): Subject[] {
  const curriculumDir = join(process.cwd(), 'curriculum');
  // Only load files that are subject definitions (have a concepts array).
  // Exclude any *schema*.json files (schema.json, contribution-schema.json, etc.)
  const files = readdirSync(curriculumDir).filter(
    f => f.endsWith('.json') && !f.includes('schema')
  );

  const result: Subject[] = [];
  for (const file of files) {
    const raw = readFileSync(join(curriculumDir, file), 'utf-8');
    const data = JSON.parse(raw);
    // Skip files that aren't subject definitions
    if (!data.id || !Array.isArray(data.concepts)) continue;
    result.push({
      id: data.id,
      name: data.name,
      description: data.description,
      concepts: data.concepts.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        prerequisites: c.prerequisites,
        gradeLevel: c.level,
        // Pass enriched fields through when present
        ...(c.objective !== undefined && { objective: c.objective }),
        ...(c.explanation !== undefined && { explanation: c.explanation }),
        ...(c.alternateExplanations !== undefined && { alternateExplanations: c.alternateExplanations }),
        ...(c.workedExamples !== undefined && { workedExamples: c.workedExamples }),
        ...(c.guidedPractice !== undefined && { guidedPractice: c.guidedPractice }),
        ...(c.masteryCheck !== undefined && { masteryCheck: c.masteryCheck }),
        ...(c.remediationPath !== undefined && { remediationPath: c.remediationPath }),
        ...(c.whyItMatters !== undefined && { whyItMatters: c.whyItMatters }),
        ...(c.metadata !== undefined && { metadata: c.metadata }),
      })),
    });
  }
  return result;
}

// Load once at startup
export const subjects: Subject[] = loadSubjects();

export function getSubject(subjectId: string): Subject | undefined {
  return subjects.find(s => s.id === subjectId);
}

export function getConcept(subjectId: string, conceptId: string): Concept | undefined {
  const subject = getSubject(subjectId);
  return subject?.concepts.find(c => c.id === conceptId);
}

export function getConceptsForGrade(subjectId: string, gradeLevel: number): Concept[] {
  const subject = getSubject(subjectId);
  if (!subject) return [];
  return subject.concepts.filter(c => c.gradeLevel <= gradeLevel);
}

export function getNextConcept(
  subjectId: string,
  completedConceptIds: string[],
  gradeLevel: number
): Concept | undefined {
  const availableConcepts = getConceptsForGrade(subjectId, gradeLevel);

  // If student has no progress, start them at their grade level (not kindergarten)
  if (completedConceptIds.length === 0) {
    // First, try to find a concept AT their grade level
    const gradeAppropriate = availableConcepts.find(concept => {
      if (concept.gradeLevel !== gradeLevel) return false;
      // Check if all prerequisites are below their grade (assumed mastered)
      return concept.prerequisites.every(prereqId => {
        const prereq = availableConcepts.find(c => c.id === prereqId);
        return prereq && prereq.gradeLevel < gradeLevel;
      });
    });

    if (gradeAppropriate) return gradeAppropriate;

    // If no concept at exact grade level, find the highest grade concept they can start
    const sortedByGrade = [...availableConcepts]
      .sort((a, b) => b.gradeLevel - a.gradeLevel);

    return sortedByGrade.find(concept => {
      return concept.prerequisites.every(prereqId => {
        const prereq = availableConcepts.find(c => c.id === prereqId);
        return prereq && prereq.gradeLevel < gradeLevel;
      });
    });
  }

  // If they have progress, use normal progression logic
  return availableConcepts.find(concept => {
    if (completedConceptIds.includes(concept.id)) return false;
    return concept.prerequisites.every(prereq => completedConceptIds.includes(prereq));
  });
}

// ── On-demand lesson resolution ──────────────────────────────────────────────

interface CachedLessonRow {
  content: string;
}

/**
 * Returns a concept enriched with lesson content from any available source:
 *   1. Pre-authored JSON (already on the concept object)
 *   2. Cached generated lesson from the DB
 *
 * Does NOT trigger generation — that's the job of the /api/curriculum/lesson endpoint.
 * This function is for internal use (e.g., the tutor chat) where we want the best
 * available content without blocking on LLM generation.
 */
export async function getConceptWithLesson(
  subjectId: string,
  conceptId: string
): Promise<Concept | undefined> {
  const concept = getConcept(subjectId, conceptId);
  if (!concept) return undefined;

  // If the concept already has full content from JSON, return as-is
  if (concept.explanation && concept.workedExamples?.length && concept.masteryCheck) {
    return concept;
  }

  // Check for cached generated lesson
  const cached = await executeSql<CachedLessonRow>(
    'SELECT content FROM generated_lessons WHERE subject_id = $1 AND concept_id = $2',
    [subjectId, conceptId]
  );

  if (cached.rows.length > 0) {
    const lesson = JSON.parse(cached.rows[0].content);
    return {
      ...concept,
      objective: lesson.objective ?? concept.objective,
      explanation: lesson.explanation ?? concept.explanation,
      alternateExplanations: lesson.alternateExplanations ?? concept.alternateExplanations,
      workedExamples: lesson.workedExamples ?? concept.workedExamples,
      guidedPractice: lesson.guidedPractice ?? concept.guidedPractice,
      masteryCheck: lesson.masteryCheck ?? concept.masteryCheck,
      remediationPath: lesson.remediationPath ?? concept.remediationPath,
      whyItMatters: lesson.whyItMatters ?? concept.whyItMatters,
    };
  }

  // No cached content — return the stub concept
  return concept;
}
