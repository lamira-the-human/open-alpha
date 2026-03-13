import { useState } from 'react';

interface ConceptExplanation {
  text: string;
  childVersion?: string;
  adultVersion?: string;
}

interface AlternateExplanation {
  type: string;
  text: string;
}

interface WorkedExample {
  problem: string;
  steps: string[];
  answer: string;
}

interface LessonIntroProps {
  objective?: string;
  explanation: ConceptExplanation;
  alternateExplanations?: AlternateExplanation[];
  workedExamples?: WorkedExample[];
  whyItMatters?: string;
  onStartChat: () => void;
}

const altTypeLabels: Record<string, string> = {
  visual: 'See it visually',
  analogy: 'Try an analogy',
  realWorld: 'Real-world example',
  stepByStep: 'Step by step',
  formal: 'Formal definition',
};

function FormattedText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <p key={i} style={{ marginBottom: '0.85rem', lineHeight: '1.7' }}>
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
          ))}
        </p>
      ))}
    </>
  );
}

export default function LessonIntro({
  objective,
  explanation,
  alternateExplanations,
  workedExamples,
  whyItMatters,
  onStartChat,
}: LessonIntroProps) {
  const [speaking, setSpeaking] = useState(false);
  const [expandedAlt, setExpandedAlt] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);

  function handleReadAloud() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(explanation.text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  const firstExample = workedExamples?.[0];
  const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>

      {/* Learning objective */}
      {objective && (
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-light)',
          fontStyle: 'italic',
          marginBottom: '1.75rem',
          lineHeight: '1.6',
        }}>
          {objective}
        </p>
      )}

      {/* Why this matters */}
      {whyItMatters && (
        <div style={{
          background: 'var(--surface)',
          borderLeft: '3px solid var(--primary)',
          borderRadius: '0 0.5rem 0.5rem 0',
          padding: '0.875rem 1rem',
          marginBottom: '2rem',
          lineHeight: '1.6',
        }}>
          <span style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--primary)',
            marginBottom: '0.35rem',
          }}>
            Why this matters
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>{whyItMatters}</span>
        </div>
      )}

      {/* Primary explanation */}
      <div style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
        <FormattedText text={explanation.text} />
      </div>

      {/* Read aloud + alternate explanation row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {hasTTS && (
          <button
            onClick={handleReadAloud}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.875rem',
              border: '1px solid var(--border)',
              borderRadius: '9999px',
              background: speaking ? 'var(--surface)' : 'transparent',
              color: 'var(--text-light)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {speaking ? '⏹ Stop' : '🔊 Read aloud'}
          </button>
        )}

        {alternateExplanations && alternateExplanations.length > 0 && (
          <>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)' }}>Try a different angle:</span>
            {alternateExplanations.map((alt, i) => (
              <button
                key={i}
                onClick={() => setExpandedAlt(expandedAlt === i ? null : i)}
                style={{
                  padding: '0.375rem 0.875rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--border)',
                  background: expandedAlt === i ? 'var(--primary)' : 'transparent',
                  color: expandedAlt === i ? 'white' : 'var(--text)',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {altTypeLabels[alt.type] ?? alt.type}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Expanded alternate explanation */}
      {expandedAlt !== null && alternateExplanations && (
        <div style={{
          padding: '1rem 1.125rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          fontSize: '0.9rem',
          marginBottom: '2rem',
        }}>
          <FormattedText text={alternateExplanations[expandedAlt].text} />
        </div>
      )}

      {/* Worked example */}
      {firstExample && (
        <div style={{ marginBottom: '2.25rem' }}>
          <button
            onClick={() => setShowExample(!showExample)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'none',
              border: 'none',
              padding: '0 0 0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--primary)',
            }}
          >
            <span style={{
              display: 'inline-block',
              transition: 'transform 0.15s',
              transform: showExample ? 'rotate(90deg)' : 'none',
              fontSize: '0.625rem',
            }}>▶</span>
            Worked example
          </button>

          {showExample && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <div style={{
                padding: '0.875rem 1rem',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}>
                {firstExample.problem}
              </div>
              <div style={{ padding: '0.875rem 1rem' }}>
                {firstExample.steps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginBottom: '0.625rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.55',
                  }}>
                    <span style={{ color: 'var(--text-light)', flexShrink: 0, minWidth: '3.5rem' }}>Step {i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
                <div style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}>
                  Answer: {firstExample.answer}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onStartChat}
        className="btn btn-primary"
        style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
      >
        Chat with your tutor →
      </button>
    </div>
  );
}
