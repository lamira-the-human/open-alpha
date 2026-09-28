import { describe, expect, it } from 'vitest';
import { checkFractionAnswer, fractionPractice } from '../src/services/fraction-practice.js';
import { handleFractionPractice } from '../src/services/fraction-handler.js';

const correctAnswers = [
  { questionId: 'meaning', answer: '3/8' },
  { questionId: 'equivalence', answer: '8' },
  { questionId: 'comparison', answer: '>' },
] as const;

const wrongAnswers = [
  { questionId: 'meaning', answer: '8/3' },
  { questionId: 'equivalence', answer: '2' },
  { questionId: 'comparison', answer: '<' },
] as const;

async function check(questionId: string, answer: unknown) {
  const response = await handleFractionPractice(
    new Request('http://localhost/api/fractions/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer }),
    })
  );
  expect(response.status).toBe(200);
  return await response.json() as { correct: boolean; explanation: string };
}

describe('fraction practice', () => {
  it('keeps answer keys off the client', () => {
    expect(fractionPractice).toHaveLength(3);
    expect(fractionPractice).not.toContain('correctAnswer');
  });

  it('grades each skill and explains the likely mistake', async () => {
    for (const question of correctAnswers) {
      expect((await check(question.questionId, question.answer)).correct).toBe(true);
    }
    for (const question of wrongAnswers) {
      const result = await check(question.questionId, question.answer);
      expect(result.correct).toBe(false);
      expect(result.explanation).toMatch(/Try|choose/i);
    }
  });

  it('rejects malformed and oversized requests', async () => {
    expect((await handleFractionPractice(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
    expect((await handleFractionPractice(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(1025) }))).status).toBe(413);
    expect((await handleFractionPractice(new Request('http://localhost', { method: 'DELETE' }))).status).toBe(405);
  });
});
