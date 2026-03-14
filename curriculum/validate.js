#!/usr/bin/env node

/**
 * Validates the curriculum graph.
 *
 * Graph checks:
 * - All prerequisite references point to concepts that exist
 * - No circular dependencies
 * - Levels are consistent (prerequisites have lower levels than dependents)
 * - No duplicate concept IDs across subjects
 *
 * Enrichment checks (for concepts with partial or full bundles):
 * - masteryCheck has exactly 5 questions
 * - masteryCheck correctAnswer is a valid option letter
 * - guidedPractice has at least 5 items
 * - workedExamples has at least 3 items
 * - Partial enrichment is warned (some fields but not all required ones)
 * - remediationPath.conceptId (if present) points to a real concept
 *
 * Usage: node curriculum/validate.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fields required for a concept to be considered "fully enriched"
const ENRICHMENT_FIELDS = [
  'objective',
  'explanation',
  'alternateExplanations',
  'workedExamples',
  'guidedPractice',
  'masteryCheck',
  'remediationPath',
  'whyItMatters',
  'metadata',
];

function loadSubjects() {
  const files = readdirSync(__dirname).filter(f => f.endsWith('.json') && !f.includes('schema'));
  return files
    .map(f => {
      const raw = readFileSync(join(__dirname, f), 'utf-8');
      const data = JSON.parse(raw);
      return { file: f, ...data };
    })
    .filter(s => s.id && Array.isArray(s.concepts));
}

function validate() {
  const subjects = loadSubjects();
  const errors = [];
  const warnings = [];

  // ── Build global concept map ────────────────────────────────────────────────

  const allConcepts = new Map();
  for (const subject of subjects) {
    for (const concept of subject.concepts) {
      if (allConcepts.has(concept.id)) {
        errors.push(`Duplicate concept ID "${concept.id}" in ${subject.file} (already defined in ${allConcepts.get(concept.id).file})`);
      }
      allConcepts.set(concept.id, { ...concept, file: subject.file, subjectId: subject.id });
    }
  }

  // ── Graph integrity checks ──────────────────────────────────────────────────

  for (const [id, concept] of allConcepts) {
    // Prerequisites exist
    for (const prereqId of concept.prerequisites) {
      if (!allConcepts.has(prereqId)) {
        errors.push(`${concept.file}: "${id}" requires "${prereqId}" which doesn't exist`);
      }
    }

    // Level consistency
    for (const prereqId of concept.prerequisites) {
      const prereq = allConcepts.get(prereqId);
      if (prereq && prereq.level > concept.level) {
        warnings.push(`${concept.file}: "${id}" (level ${concept.level}) has prerequisite "${prereqId}" at higher level (${prereq.level})`);
      }
    }
  }

  // Cycle detection via DFS
  const visited = new Set();
  const inStack = new Set();

  function hasCycle(id, path) {
    if (inStack.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycle = path.slice(cycleStart).concat(id);
      errors.push(`Cycle detected: ${cycle.join(' -> ')}`);
      return true;
    }
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);
    path.push(id);

    const concept = allConcepts.get(id);
    if (concept) {
      for (const prereqId of concept.prerequisites) {
        if (allConcepts.has(prereqId)) {
          hasCycle(prereqId, path);
        }
      }
    }

    path.pop();
    inStack.delete(id);
    return false;
  }

  for (const id of allConcepts.keys()) {
    hasCycle(id, []);
  }

  // ── Enrichment checks ───────────────────────────────────────────────────────

  const enrichedConcepts = [];
  const partialConcepts = [];

  for (const [id, concept] of allConcepts) {
    const presentFields = ENRICHMENT_FIELDS.filter(f => concept[f] !== undefined);
    if (presentFields.length === 0) continue; // skeletal concept, no enrichment expected

    const missingFields = ENRICHMENT_FIELDS.filter(f => concept[f] === undefined);
    if (missingFields.length > 0) {
      partialConcepts.push(id);
      warnings.push(`${concept.file}: "${id}" is partially enriched — missing: ${missingFields.join(', ')}`);
    } else {
      enrichedConcepts.push(id);
    }

    // masteryCheck validation
    if (concept.masteryCheck) {
      const questions = concept.masteryCheck.questions;
      if (!Array.isArray(questions) || questions.length !== 5) {
        errors.push(`${concept.file}: "${id}" masteryCheck must have exactly 5 questions (found ${Array.isArray(questions) ? questions.length : 'none'})`);
      } else {
        for (const q of questions) {
          if (!Array.isArray(q.options) || q.options.length < 3) {
            errors.push(`${concept.file}: "${id}" question "${q.id}" must have at least 3 options`);
          }
          if (q.correctAnswer && q.options) {
            // correctAnswer should be a letter (A, B, C, D) matching an option prefix
            const letter = q.correctAnswer.toUpperCase();
            const validLetters = q.options.map((_, i) => String.fromCharCode(65 + i));
            if (!validLetters.includes(letter)) {
              errors.push(`${concept.file}: "${id}" question "${q.id}" correctAnswer "${q.correctAnswer}" is not a valid option letter (${validLetters.join(', ')})`);
            }
          }
        }
      }
    }

    // guidedPractice validation
    if (concept.guidedPractice) {
      if (!Array.isArray(concept.guidedPractice) || concept.guidedPractice.length < 5) {
        warnings.push(`${concept.file}: "${id}" guidedPractice should have at least 5 items (found ${Array.isArray(concept.guidedPractice) ? concept.guidedPractice.length : 0})`);
      }
    }

    // workedExamples validation
    if (concept.workedExamples) {
      if (!Array.isArray(concept.workedExamples) || concept.workedExamples.length < 3) {
        warnings.push(`${concept.file}: "${id}" workedExamples should have at least 3 items (found ${Array.isArray(concept.workedExamples) ? concept.workedExamples.length : 0})`);
      }
    }

    // remediationPath.conceptId must point to a real concept
    if (concept.remediationPath?.conceptId) {
      if (!allConcepts.has(concept.remediationPath.conceptId)) {
        errors.push(`${concept.file}: "${id}" remediationPath.conceptId "${concept.remediationPath.conceptId}" doesn't exist`);
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  const totalConcepts = allConcepts.size;
  const rootConcepts = [...allConcepts.values()].filter(c => c.prerequisites.length === 0);
  const maxLevel = Math.max(...[...allConcepts.values()].map(c => c.level));
  const skeletalCount = totalConcepts - enrichedConcepts.length - partialConcepts.length;

  console.log(`\nCurriculum Graph Summary`);
  console.log(`${'='.repeat(40)}`);
  console.log(`Subjects:         ${subjects.length} (${subjects.map(s => s.id).join(', ')})`);
  console.log(`Total concepts:   ${totalConcepts}`);
  console.log(`  Fully enriched: ${enrichedConcepts.length}`);
  console.log(`  Partial:        ${partialConcepts.length}`);
  console.log(`  Skeletal:       ${skeletalCount}`);
  console.log(`Root concepts:    ${rootConcepts.length} (no prerequisites)`);
  console.log(`Level range:      0-${maxLevel}`);
  console.log();

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    errors.forEach(e => console.log(`  ✗ ${e}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.log(`  ! ${w}`));
    console.log();
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`✓ All checks passed.\n`);
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

validate();
