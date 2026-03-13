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
    apiKey: connectionString,  // ATXP connection string is used as bearer token
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
  model: string = 'claude-sonnet-4-20250514'
): Promise<string> {
  const openai = getClient();

  const systemPrompt = getTutorSystemPrompt(context);
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  try {
    console.log('[LLM] Making request to:', LLM_BASE_URL);
    console.log('[LLM] Model:', model);

    const response = await openai.chat.completions.create({
      model,
      messages: fullMessages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    console.log('[LLM] Response received');
    return response.choices[0]?.message?.content || 'I apologize, but I had trouble generating a response. Please try again.';
  } catch (error) {
    console.error('[LLM] Error:', error);
    throw error;
  }
}

export async function chatWithCoach(
  messages: ChatMessage[],
  context: CoachContext,
  model: string = 'claude-sonnet-4-20250514'
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
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
    temperature: 0.8,
  });

  return response.choices[0]?.message?.content || '{"questions": []}';
}

export default {
  chatWithTutor,
  chatWithCoach,
  generateQuizQuestions,
};
