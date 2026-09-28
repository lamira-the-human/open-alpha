import { checkFractionAnswer, fractionPractice } from './fraction-practice.js';

export async function handleFractionPractice(request: Request): Promise<Response> {
  if (request.method === 'GET') return Response.json({ questions: fractionPractice });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, POST' } });
  try {
    const text = await request.text();
    if (text.length > 1024) return Response.json({ error: 'Request too large' }, { status: 413 });
    const body = JSON.parse(text) as { questionId?: unknown; answer?: unknown } | null;
    if (!body || typeof body.questionId !== 'string') {
      return Response.json({ error: 'A questionId is required.' }, { status: 400 });
    }
    return Response.json(checkFractionAnswer(body.questionId, body.answer));
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? 'Invalid JSON.' : error instanceof Error ? error.message : 'Could not check answer.' }, { status: 400 });
  }
}
