import OpenAI from 'openai';

const LLM_BASE_URL = 'https://llm.atxp.ai/v1';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const connectionString = process.env.ATXP_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('ATXP_CONNECTION_STRING environment variable is required');
  }

  client = new OpenAI({
    baseURL: LLM_BASE_URL,
    apiKey: connectionString,
  });

  return client;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TutorContext {
  gradeLevel: number;
  subject: string;
  conceptName: string;
  conceptDescription: string;
  progressContext: string;
  // Enriched content — present when the concept has a full bundle
  storedExplanation?: string;
  workedExamplesText?: string;
  whyItMatters?: string;
}

export interface CoachContext {
  childGradeLevel: number;
  childProgressSummary: string;
}

function getTutorSystemPrompt(context: TutorContext): string {
  const hasStoredContent = context.storedExplanation || context.workedExamplesText;

  let prompt = `You are an encouraging AI tutor for a grade ${context.gradeLevel} student learning ${context.subject}.

Current concept: ${context.conceptName}
${context.conceptDescription}`;

  if (context.storedExplanation) {
    prompt += `\n\nCore explanation (use this as your source of truth — do not contradict it):\n${context.storedExplanation}`;
  }

  if (context.workedExamplesText) {
    prompt += `\n\nWorked examples for this concept:\n${context.workedExamplesText}`;
  }

  if (context.whyItMatters) {
    prompt += `\n\nWhy this concept matters: ${context.whyItMatters}`;
  }

  prompt += `\n\nStudent's learning history: ${context.progressContext}

Guidelines:
- Use age-appropriate language for grade ${context.gradeLevel}
- Celebrate small wins and progress
- If the student is struggling, break concepts into smaller steps
- Keep responses concise and engaging
- Ask questions to check understanding
- Be patient and supportive${hasStoredContent ? `
- Use the provided explanation and examples as your source of truth for this concept
- Do not introduce definitions or examples that contradict the stored content` : `
- Use examples relevant to their age group`}

When generating practice problems:
- Match the difficulty to grade ${context.gradeLevel}
- Provide hints if asked
- Explain why answers are correct or incorrect`;

  return prompt;
}

function getCoachSystemPrompt(context: CoachContext): string {
  return `You are a supportive AI coach for parents of students using Open Alpha.

The parent's child is in grade ${context.childGradeLevel}.
Child's recent progress: ${context.childProgressSummary}

Guidelines:
- Help the parent understand their child's learning journey
- Suggest practical ways to support learning at home
- Never do the child's work - focus on the parent's supportive role
- Be warm, encouraging, and practical
- Explain educational concepts in parent-friendly terms
- Offer specific activities to reinforce what the child is learning
- Provide encouragement strategies and tips
- Acknowledge that every child learns differently`;
}

export async function chatWithTutor(
  messages: ChatMessage[],
  context: TutorContext,
  model: string = 'claude-sonnet-4-6'
): Promise<string> {
  const openai = getClient();

  const systemPrompt = getTutorSystemPrompt(context);
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const response = await openai.chat.completions.create({
    model,
    messages: fullMessages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I had trouble generating a response. Please try again.';
}

export async function chatWithCoach(
  messages: ChatMessage[],
  context: CoachContext,
  model: string = 'claude-sonnet-4-6'
): Promise<string> {
  const openai = getClient();

  const systemPrompt = getCoachSystemPrompt(context);
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const response = await openai.chat.completions.create({
    model,
    messages: fullMessages,
    max_tokens: 1024,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || 'I apologize, but I had trouble generating a response. Please try again.';
}

// ── On-demand lesson generation ─────────────────────────────────────────────

export const LESSON_PROMPT_VERSION = 1;

export interface GeneratedLessonContent {
  objective: string;
  explanation: {
    text: string;
    childVersion?: string;
    adultVersion?: string;
  };
  alternateExplanations: Array<{ type: string; text: string }>;
  workedExamples: Array<{ problem: string; steps: string[]; answer: string }>;
  guidedPractice: Array<{
    id: string;
    prompt: string;
    answer: string;
    hint: string;
    feedback: { correct: string; incorrect: string };
  }>;
  masteryCheck: {
    passingScore: number;
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>;
  };
  remediationPath: {
    action: string;
    message: string;
  };
  whyItMatters: string;
}

interface LessonGenerationContext {
  subjectName: string;
  conceptId: string;
  conceptName: string;
  conceptDescription: string;
  level: number;
  prerequisites: string[];
  gradeBand?: string;
}

function getLessonGenerationPrompt(ctx: LessonGenerationContext): string {
  const isAdult = ctx.level > 12;
  const audienceNote = isAdult
    ? 'This is an adult learner. Use practical, real-world framing. Skip childVersion in the explanation. Include adultVersion.'
    : `This is for approximately grade level ${ctx.level}. Include both childVersion (for younger learners) and adultVersion (for older/adult learners) in the explanation.`;

  return `Generate a complete lesson module for the following concept. Return ONLY valid JSON matching the schema below — no markdown, no commentary.

Subject: ${ctx.subjectName}
Concept: ${ctx.conceptName}
Description: ${ctx.conceptDescription}
Level: ${ctx.level}
Prerequisites: ${ctx.prerequisites.length > 0 ? ctx.prerequisites.join(', ') : 'None'}

${audienceNote}

Required JSON schema:
{
  "objective": "One sentence: what the learner should be able to do after this lesson.",
  "explanation": {
    "text": "Primary explanation. Clear, accurate, well-structured. At least 100 words.",
    "childVersion": "Simplified version for younger learners (K-5). Concrete examples, simple language. Omit for adult-only subjects.",
    "adultVersion": "Practical version for older/adult learners. Real-world applications."
  },
  "alternateExplanations": [
    { "type": "visual", "text": "Explanation using visual/spatial reasoning or diagrams described in text." },
    { "type": "realWorld", "text": "Explanation grounded in a practical real-world scenario." }
  ],
  "workedExamples": [
    { "problem": "Problem statement", "steps": ["Step 1: reasoning...", "Step 2: reasoning..."], "answer": "Final answer" },
    { "problem": "...", "steps": ["..."], "answer": "..." },
    { "problem": "...", "steps": ["..."], "answer": "..." }
  ],
  "guidedPractice": [
    { "id": "${ctx.conceptId}-gp1", "prompt": "Practice problem", "answer": "Expected answer", "hint": "Helpful hint without giving it away", "feedback": { "correct": "Reinforcing message", "incorrect": "Diagnostic message explaining what to look for" } },
    { "id": "${ctx.conceptId}-gp2", "prompt": "...", "answer": "...", "hint": "...", "feedback": { "correct": "...", "incorrect": "..." } },
    { "id": "${ctx.conceptId}-gp3", "prompt": "...", "answer": "...", "hint": "...", "feedback": { "correct": "...", "incorrect": "..." } },
    { "id": "${ctx.conceptId}-gp4", "prompt": "...", "answer": "...", "hint": "...", "feedback": { "correct": "...", "incorrect": "..." } },
    { "id": "${ctx.conceptId}-gp5", "prompt": "...", "answer": "...", "hint": "...", "feedback": { "correct": "...", "incorrect": "..." } }
  ],
  "masteryCheck": {
    "passingScore": 80,
    "questions": [
      { "id": "${ctx.conceptId}-mc1", "question": "Question text", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "A", "explanation": "Why this is correct" },
      { "id": "${ctx.conceptId}-mc2", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "B", "explanation": "..." },
      { "id": "${ctx.conceptId}-mc3", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "C", "explanation": "..." },
      { "id": "${ctx.conceptId}-mc4", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "D", "explanation": "..." },
      { "id": "${ctx.conceptId}-mc5", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correctAnswer": "A", "explanation": "..." }
    ]
  },
  "remediationPath": {
    "action": "review_prerequisites",
    "message": "Encouraging message about what to do if they didn't pass. Point them toward reviewing the foundational ideas."
  },
  "whyItMatters": "Short explanation of why this concept matters in school, work, or daily life."
}

Rules:
- Every worked example must have at least 2 steps that explain REASONING, not just arithmetic.
- Guided practice problems should progress from easy to hard.
- Mastery check questions should test understanding, not just recall.
- All content must be factually accurate.
- Do not vary the correct answer distribution — mix them naturally.
- Return ONLY the JSON object. No wrapping, no code fences.`;
}

export async function generateLesson(
  ctx: LessonGenerationContext,
  model: string = 'claude-sonnet-4-6'
): Promise<GeneratedLessonContent> {
  const openai = getClient();

  const prompt = getLessonGenerationPrompt(ctx);

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    temperature: 0.4,
  });

  const raw = response.choices[0]?.message?.content || '';

  // Strip any accidental code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  const parsed = JSON.parse(cleaned) as GeneratedLessonContent;
  return parsed;
}

export async function generateQuizQuestions(
  subject: string,
  conceptName: string,
  gradeLevel: number,
  count: number = 5
): Promise<string> {
  const openai = getClient();

  const prompt = `Generate ${count} multiple-choice quiz questions for a grade ${gradeLevel} student on the topic: ${conceptName} (${subject}).

Format each question as JSON:
{
  "questions": [
    {
      "question": "The question text",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correctAnswer": "A",
      "explanation": "Why this is the correct answer"
    }
  ]
}

Make questions age-appropriate and progressively challenging.`;

  const response = await openai.chat.completions.create({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
    temperature: 0.8,
  });

  return response.choices[0]?.message?.content || '{"questions": []}';
}
