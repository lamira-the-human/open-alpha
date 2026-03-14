/**
 * GET /api/curriculum/graph
 *
 * Public endpoint — no authentication required.
 * Returns the complete curriculum graph as a machine-readable JSON dataset.
 *
 * This is the "Wikipedia data dump" equivalent: a public good that schools,
 * developers, and agents can build on top of. CORS is open so anyone can fetch it.
 *
 * Use cases:
 *   - Agent contributor picks an empty node and generates content for it
 *   - School builds a standards-alignment tool on top of the graph
 *   - Developer visualizes the prerequisite DAG
 *   - Researcher studies K-12 concept dependencies
 */

import { subjects } from '../_lib/curriculum.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=3600',
};

export function GET(_request: Request) {
  if (_request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(_request.url);
  const subjectId = url.searchParams.get('subject');
  const format = url.searchParams.get('format') || 'full';

  const targetSubjects = subjectId
    ? subjects.filter(s => s.id === subjectId)
    : subjects;

  if (subjectId && targetSubjects.length === 0) {
    return Response.json(
      { error: `Subject '${subjectId}' not found. Available: ${subjects.map(s => s.id).join(', ')}` },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  if (format === 'dag') {
    // Minimal DAG format: nodes + edges only — for graph visualization tools
    const nodes: Array<{ id: string; name: string; subject: string; level: number }> = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (const subject of targetSubjects) {
      for (const concept of subject.concepts) {
        nodes.push({
          id: concept.id,
          name: concept.name,
          subject: subject.id,
          level: concept.gradeLevel,
        });
        for (const prereq of concept.prerequisites) {
          edges.push({ from: prereq, to: concept.id });
        }
      }
    }

    return Response.json(
      { nodes, edges, generated_at: new Date().toISOString() },
      { headers: CORS_HEADERS }
    );
  }

  if (format === 'summary') {
    // Summary: subject list with concept count and enrichment stats
    const summary = targetSubjects.map(subject => {
      const total = subject.concepts.length;
      const enriched = subject.concepts.filter(c => c.explanation && c.workedExamples && c.masteryCheck).length;
      const partial = subject.concepts.filter(c => c.explanation && (!c.workedExamples || !c.masteryCheck)).length;
      const stub = total - enriched - partial;

      return {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        totalConcepts: total,
        enrichedConcepts: enriched,
        partialConcepts: partial,
        stubConcepts: stub,
        completionPercent: total > 0 ? Math.round((enriched / total) * 100) : 0,
      };
    });

    return Response.json(
      { subjects: summary, generated_at: new Date().toISOString() },
      { headers: CORS_HEADERS }
    );
  }

  // Default: full graph with all concept details
  const graph = targetSubjects.map(subject => ({
    id: subject.id,
    name: subject.name,
    description: subject.description,
    concepts: subject.concepts.map(concept => ({
      id: concept.id,
      name: concept.name,
      description: concept.description,
      prerequisites: concept.prerequisites,
      level: concept.gradeLevel,
      // Enrichment presence flags (don't send full content in graph endpoint to keep response small)
      hasExplanation: !!concept.explanation,
      hasWorkedExamples: !!(concept.workedExamples?.length),
      hasGuidedPractice: !!(concept.guidedPractice?.length),
      hasMasteryCheck: !!concept.masteryCheck,
      objective: concept.objective,
      metadata: concept.metadata,
    })),
  }));

  return Response.json(
    {
      version: '1.0',
      description: 'Open Alpha curriculum graph — a public domain K-12 knowledge graph',
      license: 'CC BY 4.0',
      contribute: 'https://github.com/open-alpha/open-alpha',
      subjects: graph,
      generated_at: new Date().toISOString(),
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
