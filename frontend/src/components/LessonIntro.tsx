import React, { useState } from 'react';

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

const DEPTH_LEVELS = [
  { id: 'eli5' as const,     label: 'ELI5' },
  { id: 'standard' as const, label: 'Standard' },
  { id: 'expert' as const,   label: 'Expert' },
];
type DepthLevel = 'eli5' | 'standard' | 'expert';

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={key++}>{match[1]}</strong>);
    else parts.push(<em key={key++}>{match[2]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function FormattedText({ text }: { text: string }) {
  const elements: React.ReactNode[] = [];

  text.split('\n\n').forEach((block, bi) => {
    const lines = block.split('\n');
    type Seg = { type: 'list'; items: string[] } | { type: 'prose'; lines: string[] };
    const segs: Seg[] = [];
    let cur: Seg | null = null;

    for (const line of lines) {
      if (/^[•\-]\s/.test(line)) {
        if (cur?.type !== 'list') { cur = { type: 'list', items: [] }; segs.push(cur); }
        (cur as { type: 'list'; items: string[] }).items.push(line.replace(/^[•\-]\s/, ''));
      } else {
        if (cur?.type !== 'prose') { cur = { type: 'prose', lines: [] }; segs.push(cur); }
        (cur as { type: 'prose'; lines: string[] }).lines.push(line);
      }
    }

    segs.forEach((seg, si) => {
      if (seg.type === 'list') {
        elements.push(
          <ul key={`${bi}-${si}`} style={{ paddingLeft: '1.25rem', marginBottom: '0.85rem', lineHeight: '1.7' }}>
            {seg.items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}
          </ul>
        );
      } else {
        elements.push(
          <p key={`${bi}-${si}`} style={{ marginBottom: '0.85rem', lineHeight: '1.7' }}>
            {seg.lines.map((line, li, arr) => (
              <span key={li}>{renderInline(line)}{li < arr.length - 1 && <br />}</span>
            ))}
          </p>
        );
      }
    });
  });

  return <>{elements}</>;
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
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());
  function toggleExample(idx: number) {
    setExpandedExamples(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }
  const [depthLevel, setDepthLevel] = useState<DepthLevel>('standard');

  const availableLevels = DEPTH_LEVELS.filter(l => {
    if (l.id === 'expert') return !!explanation.adultVersion;
    return true;
  });

  const currentText =
    depthLevel === 'eli5' && explanation.childVersion ? explanation.childVersion :
    depthLevel === 'expert' && explanation.adultVersion ? explanation.adultVersion :
    explanation.text;

  function handleReadAloud() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

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

      {/* Depth level selector */}
      {availableLevels.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>Explain like I'm:</span>
          {availableLevels.map(level => (
            <button
              key={level.id}
              onClick={() => setDepthLevel(level.id)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                border: '1px solid var(--border)',
                background: depthLevel === level.id ? 'var(--primary)' : 'transparent',
                color: depthLevel === level.id ? 'white' : 'var(--text)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {level.label}
            </button>
          ))}
        </div>
      )}

      {/* Primary explanation */}
      <div style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
        <FormattedText text={currentText} />
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

      {/* Worked examples */}
      {workedExamples && workedExamples.length > 0 && (
        <div style={{ marginBottom: '2.25rem' }}>
          {workedExamples.map((example, idx) => {
            const isOpen = expandedExamples.has(idx);
            const label = workedExamples.length > 1 ? `Worked example ${idx + 1}` : 'Worked example';
            return (
              <div key={idx} style={{ marginBottom: idx < workedExamples.length - 1 ? '0.75rem' : 0 }}>
                <button
                  onClick={() => toggleExample(idx)}
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
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    fontSize: '0.625rem',
                  }}>▶</span>
                  {label}
                </button>

                {isOpen && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                    <div style={{
                      padding: '0.875rem 1rem',
                      background: 'var(--surface)',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                    }}>
                      {example.problem}
                    </div>
                    <div style={{ padding: '0.875rem 1rem' }}>
                      {example.steps.map((step, i) => (
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
                        Answer: {example.answer}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
