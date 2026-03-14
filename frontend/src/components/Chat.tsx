import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '../App';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  subject: string;
  conceptId: string;
  explanationLevel?: string;
}

export default function Chat({ subject, conceptId, explanationLevel }: ChatProps) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset when concept changes
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    setInput('');
  }, [conceptId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          subject,
          conceptId,
          sessionId: sessionId || undefined,
          explanationLevel: explanationLevel || undefined,
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
        { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again!' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const starterPrompts = [
    "Explain this concept to me",
    "Can you give me an example?",
    "I don't understand, can you break it down?",
    "Give me a practice problem",
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Start a conversation with your AI tutor. Ask questions, request explanations, or practice problems!
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              {starterPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInput(prompt)}
                  className="btn btn-outline"
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {prompt}
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
                  aria-label="Tutor is thinking"
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

      {/* Input Area */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', background: 'var(--surface)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Ask your tutor a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || loading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
