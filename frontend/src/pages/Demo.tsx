/**
 * Demo page — instant learning without signup.
 * Lets anyone try the AI tutor in 3 clicks:
 *   1. Pick a subject
 *   2. Pick a concept
 *   3. Start chatting
 *
 * Uses the /api/demo/chat endpoint. Session tracked by sessionId in sessionStorage.
 * Progress is not saved. When the message limit is reached, nudges toward signup.
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Concept {
  conceptId: string;
  conceptName: string;
  subjectId: string;
  level: number;
  completenessPercent: number;
  demandScore: number;
  prerequisites: string[];
}

const SUBJECTS = [
  { id: 'math', name: 'Mathematics', emoji: '∑', description: 'From counting to calculus' },
  { id: 'algebra1', name: 'Algebra 1', emoji: 'x²', description: 'High school algebra — Common Core' },
  { id: 'reading', name: 'Reading & Writing', emoji: '📖', description: 'Comprehension through critical analysis' },
  { id: 'science', name: 'Science', emoji: '🔬', description: 'Life, earth, and physical sciences' },
];

const GRADE_OPTIONS = [
  { value: 0, label: 'Kindergarten' },
  { value: 1, label: 'Grade 1' },
  { value: 2, label: 'Grade 2' },
  { value: 3, label: 'Grade 3' },
  { value: 4, label: 'Grade 4' },
  { value: 5, label: 'Grade 5' },
  { value: 6, label: 'Grade 6' },
  { value: 7, label: 'Grade 7' },
  { value: 8, label: 'Grade 8' },
  { value: 9, label: 'Grade 9 (Freshman)' },
  { value: 10, label: 'Grade 10 (Sophomore)' },
  { value: 11, label: 'Grade 11 (Junior)' },
  { value: 12, label: 'Grade 12 (Senior)' },
];

type Step = 'select-subject' | 'select-concept' | 'learning';

export default function Demo() {
  const [step, setStep] = useState<Step>('select-subject');
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [gradeLevel, setGradeLevel] = useState(9);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesRemaining, setMessagesRemaining] = useState(20);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (step === 'learning') {
      inputRef.current?.focus();
    }
  }, [step]);

  async function loadConcepts(subjectId: string) {
    setLoadingConcepts(true);
    setError('');
    try {
      const res = await fetch(`/api/curriculum/graph?subject=${subjectId}&format=full`);
      const data = await res.json();
      if (data.subjects && data.subjects[0]) {
        const allConcepts: Concept[] = data.subjects[0].concepts
          .filter((c: Concept & { level: number }) => c.level <= gradeLevel + 2)
          .map((c: { conceptId?: string; id?: string; conceptName?: string; name?: string; level?: number; completenessPercent?: number; demandScore?: number; prerequisites?: string[] }) => ({
            conceptId: c.conceptId || c.id,
            conceptName: c.conceptName || c.name,
            subjectId,
            level: c.level || 0,
            completenessPercent: c.completenessPercent || 0,
            demandScore: c.demandScore || 0,
            prerequisites: c.prerequisites || [],
          }));
        setConcepts(allConcepts);
      }
    } catch {
      setError('Failed to load concepts. Please try again.');
    } finally {
      setLoadingConcepts(false);
    }
  }

  function handleSubjectSelect(subjectId: string) {
    loadConcepts(subjectId);
    setStep('select-concept');
  }

  function handleConceptSelect(concept: Concept) {
    setSelectedConcept(concept);
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm your AI tutor. Today we're learning about **${concept.conceptName}**.\n\nTo get started — what do you already know about this topic? Or just say "explain it to me from the beginning" and we'll start fresh!`,
    }]);
    setStep('learning');
  }

  async function sendMessage() {
    if (!input.trim() || loading || limitReached || !selectedConcept) return;

    const userMessage = input.trim();
    setInput('');
    setError('');

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          subject: selectedConcept.subjectId,
          conceptId: selectedConcept.conceptId,
          gradeLevel,
          sessionId,
        }),
      });

      const data = await res.json();

      if (data.limitReached) {
        setLimitReached(true);
        setMessagesUsed(data.messagesUsed);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setMessages(messages); // revert
        return;
      }

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
      setMessagesUsed(data.messagesUsed);
      setMessagesRemaining(data.messagesRemaining);

      if (data.limitReached) {
        setLimitReached(true);
      }
    } catch {
      setError('Connection error. Please try again.');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function resetDemo() {
    setStep('select-subject');
    setSelectedConcept(null);
    setMessages([]);
    setSessionId(null);
    setMessagesUsed(0);
    setMessagesRemaining(20);
    setLimitReached(false);
    setError('');
    setInput('');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.25rem', textDecoration: 'none' }}>
              Open Alpha
            </Link>
            <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
              Demo Mode
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {step === 'learning' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                {messagesRemaining} messages left
              </span>
            )}
            <Link to="/signup?role=student" className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Step 1: Select Subject */}
      {step === 'select-subject' && (
        <div className="container" style={{ padding: '3rem 1rem', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              What would you like to learn?
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>
              No signup needed — start learning in seconds.
            </p>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              YOUR GRADE LEVEL
            </label>
            <select
              value={gradeLevel}
              onChange={e => setGradeLevel(Number(e.target.value))}
              style={{
                width: '100%', padding: '0.75rem', border: '1px solid var(--border)',
                borderRadius: '8px', fontSize: '1rem', background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              {GRADE_OPTIONS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {SUBJECTS.map(subject => (
              <button
                key={subject.id}
                onClick={() => handleSubjectSelect(subject.id)}
                style={{
                  padding: '1.5rem', border: '2px solid var(--border)', borderRadius: '12px',
                  background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{subject.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{subject.name}</div>
                <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>{subject.description}</div>
              </button>
            ))}
          </div>

          <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '2rem' }}>
            Demo gives you 20 messages. <Link to="/signup?role=student" style={{ color: 'var(--primary)' }}>Sign up free</Link> for unlimited learning.
          </p>
        </div>
      )}

      {/* Step 2: Select Concept */}
      {step === 'select-concept' && (
        <div className="container" style={{ padding: '2rem 1rem', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button onClick={() => setStep('select-subject')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '1.25rem', padding: '0' }}>
              ←
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              Pick a concept to learn
            </h2>
          </div>

          {loadingConcepts && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              Loading concepts...
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', marginBottom: '1rem', color: '#991b1b' }}>
              {error}
            </div>
          )}

          {!loadingConcepts && concepts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {concepts.map(concept => (
                <button
                  key={concept.conceptId}
                  onClick={() => handleConceptSelect(concept)}
                  style={{
                    padding: '1rem 1.25rem', border: '1px solid var(--border)', borderRadius: '8px',
                    background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)')}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{concept.conceptName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                      Level {concept.level}
                    </div>
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Learning Chat */}
      {step === 'learning' && selectedConcept && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 65px)' }}>

          {/* Concept header bar */}
          <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{selectedConcept.conceptName}</span>
              <span style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                — {SUBJECTS.find(s => s.id === selectedConcept.subjectId)?.name}
              </span>
            </div>
            <button
              onClick={resetDemo}
              style={{ background: 'none', border: '1px solid var(--border)', padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-light)' }}
            >
              Change topic
            </button>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '0.875rem 1.125rem',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user' ? 'var(--primary)' : 'var(--surface)',
                    color: msg.role === 'user' ? 'white' : 'var(--text)',
                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.875rem 1.125rem', borderRadius: '18px 18px 18px 4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-light)' }}>
                  Thinking...
                </div>
              </div>
            )}

            {limitReached && (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--surface)', border: '2px solid var(--primary)', borderRadius: '12px', marginTop: '1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>🎉</div>
                <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>You used all {messagesUsed} demo messages!</h3>
                <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                  Create a free account to keep learning with no limits. Your progress will be tracked so you can pick up right where you left off.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/signup?role=student" className="btn btn-primary">
                    Create free account
                  </Link>
                  <Link to="/signup?role=parent" className="btn btn-outline">
                    Set up for my child
                  </Link>
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {!limitReached && (
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'white', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your tutor anything..."
                disabled={loading}
                style={{
                  flex: 1, padding: '0.875rem 1.125rem', border: '1px solid var(--border)',
                  borderRadius: '24px', fontSize: '1rem', outline: 'none',
                  background: 'var(--surface)',
                  opacity: loading ? 0.6 : 1,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="btn btn-primary"
                style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {loading ? '•' : '↑'}
              </button>
            </div>
          )}

          {/* Message count footer */}
          {!limitReached && (
            <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-light)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              {messagesUsed > 0 ? `${messagesUsed}/20 messages used` : 'Demo mode — 20 messages included'}
              {' · '}
              <Link to="/signup?role=student" style={{ color: 'var(--primary)' }}>Sign up free for unlimited</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
