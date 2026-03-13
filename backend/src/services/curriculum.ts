import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const curriculumDir = join(__dirname, '..', '..', '..', 'curriculum');
  const files = readdirSync(curriculumDir).filter(f => f.endsWith('.json') && f !== 'schema.json');

  return files.map(file => {
    const raw = readFileSync(join(curriculumDir, file), 'utf-8');
    const data = JSON.parse(raw);
    return {
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
    };
  });
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

  // Find concepts where all prerequisites are completed
  return availableConcepts.find(concept => {
    if (completedConceptIds.includes(concept.id)) return false;
    return concept.prerequisites.every(prereq => completedConceptIds.includes(prereq));
  });
}

export default {
  subjects,
  getSubject,
  getConcept,
  getConceptsForGrade,
  getNextConcept,
};
