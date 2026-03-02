import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Concept {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  gradeLevel: number;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  concepts: Concept[];
}

interface JsonConcept {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
  level: number;
}

interface JsonSubject {
  id: string;
  name: string;
  description: string;
  concepts: JsonConcept[];
}

function loadSubjects(): Subject[] {
  const curriculumDir = join(process.cwd(), 'curriculum');
  const files = readdirSync(curriculumDir).filter(f => f.endsWith('.json') && f !== 'schema.json');

  return files.map(file => {
    const raw = readFileSync(join(curriculumDir, file), 'utf-8');
    const data: JsonSubject = JSON.parse(raw);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      concepts: data.concepts.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        prerequisites: c.prerequisites,
        gradeLevel: c.level,
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
