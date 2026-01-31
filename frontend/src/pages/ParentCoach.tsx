import { useState, useEffect, useRef, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import Spinner from '../components/Spinner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Child {
  student_id: number;
  grade_level: number;
  display_name: string | null;
}

export default function ParentCoach() {
  const { logout, token } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChildren();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchChildren() {
    try {
      const res = await fetch('/api/coach/children', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setChildren(data.children);
        if (data.children.length > 0) {
          setSelectedChild(data.children[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch children:', error);
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedChild || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          childId: selectedChild.student_id,
          sessionId: sessionId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startNewSession() {
    setMessages([]);
    setSessionId(null);
  }

  const gradeLabels: Record<number, string> = {
    0: 'Kindergarten',
    1: '1st Grade',
    2: '2nd Grade',
    3: '3rd Grade',
    4: '4th Grade',
    5: '5th Grade',
    6: '6th Grade',
    7: '7th Grade',
    8: '8th Grade',
    9: '9th Grade',
    10: '10th Grade',
    11: '11th Grade',
    12: '12th Grade',
  };

  const suggestedQuestions = [
    'How can I help my child with math at home?',
    'What are some fun ways to encourage reading?',
    'My child seems frustrated with homework. What should I do?',
    'How do I know if my child is falling behind?',
  ];

  if (initialLoading) {
    return <Spinner size="large" text="Loading..." />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/parent" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>
              ← Dashboard
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Parent Coach</h1>
          </div>
          <div className="mobile-header-actions">
            {children.length > 0 && (
              <select
                value={selectedChild?.student_id || ''}
                onChange={(e) => {
                  const child = children.find((c) => c.student_id === parseInt(e.target.value, 10));
                  if (child) {
                    setSelectedChild(child);
                    startNewSession();
                  }
                }}
                className="input"
                style={{ width: 'auto', minWidth: '120px' }}
              >
                {children.map((child) => (
                  <option key={child.student_id} value={child.student_id}>
                    {child.display_name || `Child (${gradeLabels[child.grade_level]})`}
                  </option>
                ))}
              </select>
            )}
            <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children.length === 0 ? (
          <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '1rem' }}>No Children Linked</h2>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Link a child's account to get personalized parenting support.
            </p>
            <Link to="/parent" className="btn btn-primary">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Welcome to Parent Coach
                    </h2>
                    <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
                      I'm here to help you support {selectedChild?.display_name || 'your child'}'s learning journey.
                      Ask me anything about education, study habits, or how to help at home.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => setInput(question)}
                          className="btn btn-outline"
                          style={{ fontSize: '0.875rem' }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '80%',
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            background: message.role === 'user' ? 'var(--primary)' : 'var(--surface)',
                            color: message.role === 'user' ? 'white' : 'var(--text)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            background: 'var(--surface)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                          role="status"
                          aria-label="Coach is thinking"
                        >
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '1rem' }}>
              <form
                onSubmit={handleSubmit}
                style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}
              >
                <input
                  type="text"
                  className="input"
                  placeholder="Ask about supporting your child's learning..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!input.trim() || loading}
                >
                  Send
                </button>
              </form>
              {messages.length > 0 && (
                <div style={{ maxWidth: '800px', margin: '0.75rem auto 0', textAlign: 'center' }}>
                  <button
                    onClick={startNewSession}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Start new conversation
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
