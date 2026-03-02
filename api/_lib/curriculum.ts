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

  // If student has no progress, start them at their grade level (not kindergarten)
  // Find concepts at or just below their grade level that have no prerequisites
  // or whose prerequisites are below their grade level (assumed competent)
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
