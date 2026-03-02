#!/usr/bin/env node

/**
 * Validates the curriculum graph.
 *
 * Checks:
 * - All prerequisite references point to concepts that exist
 * - No circular dependencies
 * - Levels are consistent (prerequisites have lower levels than dependents)
 * - No duplicate concept IDs across subjects
 *
 * Usage: node curriculum/validate.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSubjects() {
  const files = readdirSync(__dirname).filter(f => f.endsWith('.json') && f !== 'schema.json');
  return files.map(f => {
    const raw = readFileSync(join(__dirname, f), 'utf-8');
    return { file: f, ...JSON.parse(raw) };
  });
}

function validate() {
  const subjects = loadSubjects();
  const errors = [];
  const warnings = [];

  // Build a global map of all concept IDs
  const allConcepts = new Map();
  for (const subject of subjects) {
    for (const concept of subject.concepts) {
      if (allConcepts.has(concept.id)) {
        errors.push(`Duplicate concept ID "${concept.id}" in ${subject.file} (already defined in ${allConcepts.get(concept.id).file})`);
      }
      allConcepts.set(concept.id, { ...concept, file: subject.file, subjectId: subject.id });
    }
  }

  // Check each concept
  for (const [id, concept] of allConcepts) {
    // Check prerequisites exist
    for (const prereqId of concept.prerequisites) {
      if (!allConcepts.has(prereqId)) {
        errors.push(`${concept.file}: "${id}" requires "${prereqId}" which doesn't exist`);
      }
    }

    // Check level consistency
    for (const prereqId of concept.prerequisites) {
      const prereq = allConcepts.get(prereqId);
      if (prereq && prereq.level > concept.level) {
        warnings.push(`${concept.file}: "${id}" (level ${concept.level}) has prerequisite "${prereqId}" at higher level (${prereq.level})`);
      }
    }
  }

  // Check for cycles using DFS
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

  // Report
  const totalConcepts = allConcepts.size;
  const rootConcepts = [...allConcepts.values()].filter(c => c.prerequisites.length === 0);
  const maxLevel = Math.max(...[...allConcepts.values()].map(c => c.level));

  console.log(`\nCurriculum Graph Summary`);
  console.log(`${'='.repeat(40)}`);
  console.log(`Subjects:       ${subjects.length} (${subjects.map(s => s.id).join(', ')})`);
  console.log(`Total concepts: ${totalConcepts}`);
  console.log(`Root concepts:  ${rootConcepts.length} (no prerequisites)`);
  console.log(`Level range:    0-${maxLevel}`);
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
