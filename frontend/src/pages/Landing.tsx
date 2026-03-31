import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

// ── Pre-canned interactive lesson demo ─────────────────────────────────────

interface DemoInterest {
  id: string;
  label: string;
  emoji: string;
}

const DEMO_INTERESTS: DemoInterest[] = [
  { id: 'baseball', label: 'Baseball', emoji: '⚾' },
  { id: 'minecraft', label: 'Minecraft', emoji: '🟩' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'space', label: 'Space', emoji: '🚀' },
  { id: 'music', label: 'Music', emoji: '🎵' },
];

const DEMO_CONCEPT = 'Fractions';

const DEMO_LESSONS: Record<string, { lesson: string; problem: string; options: string[]; correct: number; explanation: string }> = {
  baseball: {
    lesson: `A fraction represents part of a whole — a numerator (top) over a denominator (bottom).\n\nImagine a baseball game has **9 innings**. If your team has played **4 innings**, they've completed **4/9** of the game.\n\nThe denominator (9) tells you the total innings. The numerator (4) tells you how many are done. That's what a fraction is — **how many parts out of the whole**.`,
    problem: 'A pitcher throws 30 pitches in an inning. 12 are strikes. What fraction of pitches are strikes?',
    options: ['12/30', '30/12', '12/42', '18/30'],
    correct: 0,
    explanation: 'The total pitches (whole) = 30, and the strikes (part) = 12, so the fraction is 12/30.',
  },
  minecraft: {
    lesson: `A fraction represents part of a whole — a numerator (top) over a denominator (bottom).\n\nPicture a **stack of 64 blocks** in Minecraft. If you've placed **16 blocks**, you've used **16/64** of your stack.\n\nThe denominator (64) is your full stack. The numerator (16) is how many you used. A fraction is just **how many parts of the whole thing**.`,
    problem: 'You have a stack of 64 cobblestone. You use 24 blocks to build a wall. What fraction of your stack did you use?',
    options: ['64/24', '24/64', '24/40', '40/64'],
    correct: 1,
    explanation: 'The total stack (whole) = 64, and blocks used (part) = 24, so the fraction is 24/64.',
  },
  cooking: {
    lesson: `A fraction represents part of a whole — a numerator (top) over a denominator (bottom).\n\nSay a recipe needs **4 cups** of flour total, and you've measured out **1 cup** so far. You've added **1/4** of the flour.\n\nThe denominator (4) is the full amount needed. The numerator (1) is what you've done. A fraction is just **how much of the recipe you've measured**.`,
    problem: 'A pizza is cut into 8 slices. You eat 3 slices. What fraction of the pizza did you eat?',
    options: ['8/3', '3/5', '3/8', '5/8'],
    correct: 2,
    explanation: 'The total slices (whole) = 8, and slices eaten (part) = 3, so the fraction is 3/8.',
  },
  space: {
    lesson: `A fraction represents part of a whole — a numerator (top) over a denominator (bottom).\n\nImagine a rocket journey to the Moon takes **3 days**. After **1 day**, the astronauts have completed **1/3** of the trip.\n\nThe denominator (3) is the total journey. The numerator (1) is how far they've traveled. A fraction is **what portion of the mission is complete**.`,
    problem: 'A space station orbits Earth 16 times per day. After 6 orbits, what fraction of the daily orbits are complete?',
    options: ['16/6', '6/10', '6/16', '10/16'],
    correct: 2,
    explanation: 'The total orbits (whole) = 16, and completed orbits (part) = 6, so the fraction is 6/16.',
  },
  music: {
    lesson: `A fraction represents part of a whole — a numerator (top) over a denominator (bottom).\n\nThink of a **measure in 4/4 time** — it holds **4 beats**. A half note fills **2 beats**, which is **2/4** of the measure.\n\nThe denominator (4) is the total beats per measure. The numerator (2) is how many beats the note takes. A fraction is **how much of the measure one note fills**.`,
    problem: 'A song has 12 bars. You have learned to play 5 bars. What fraction of the song can you play?',
    options: ['12/5', '5/7', '7/12', '5/12'],
    correct: 3,
    explanation: 'The total bars (whole) = 12, and bars learned (part) = 5, so the fraction is 5/12.',
  },
};

// ── Typewriter effect ──────────────────────────────────────────────────────

function useTypewriter(text: string, speed: number = 12) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Inline markdown-bold renderer ──────────────────────────────────────────

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Landing page ───────────────────────────────────────────────────────────

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);

  const demo = selectedInterest ? DEMO_LESSONS[selectedInterest] : null;
  const { displayed: lessonText, done: lessonDone } = useTypewriter(
    demo?.lesson || '',
    10
  );

  function handleInterestClick(id: string) {
    setSelectedInterest(id);
    setQuizAnswer(null);
    setShowResult(false);
    // Scroll the demo into view on mobile
    setTimeout(() => demoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function handleQuizAnswer(index: number) {
    if (showResult) return;
    setQuizAnswer(index);
    setShowResult(true);
  }

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden' }}>

      {/* ── Hero ── */}
      <section style={{
        padding: '5rem 0 4rem',
        textAlign: 'center',
        background: 'linear-gradient(180deg, #eef2ff 0%, var(--background) 100%)',
      }}>
        <div className="container">
          <div style={{
            display: 'inline-block',
            padding: '0.25rem 0.875rem',
            borderRadius: '9999px',
            background: 'rgba(79,70,229,0.1)',
            color: 'var(--primary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}>
            Free &amp; open source
          </div>

          <h1 className="hero-title" style={{
            fontSize: '3.25rem',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '1.25rem',
            color: 'var(--text)',
            letterSpacing: '-0.02em',
          }}>
            Learn faster.<br />
            <span style={{ color: 'var(--primary)' }}>Earn your time back.</span>
          </h1>

          <p className="hero-subtitle" style={{
            fontSize: '1.25rem',
            color: 'var(--text-light)',
            maxWidth: '580px',
            margin: '0 auto 2rem',
            lineHeight: 1.6,
          }}>
            An AI tutor that teaches through <em>your</em> interests.
            Master concepts at your own pace, prove it with quizzes,
            and get your free time back.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const el = document.getElementById('try-it');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-primary"
              style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }}
            >
              See how it works
            </button>
            <Link
              to="/signup?role=student"
              className="btn btn-outline"
              style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }}
            >
              Start learning free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Philosophy strip ── */}
      <section style={{
        padding: '2.5rem 0',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '3rem',
          flexWrap: 'wrap',
          textAlign: 'center',
        }}>
          {[
            { num: '1', title: 'Tell us what you love', desc: 'Baseball, Minecraft, cooking — anything.' },
            { num: '2', title: 'AI builds YOUR lesson', desc: 'Same math, framed in your world.' },
            { num: '3', title: 'Prove mastery, earn time', desc: 'Pass the quiz, get your time back.' },
          ].map(({ num, title, desc }) => (
            <div key={num} style={{ maxWidth: '240px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem', margin: '0 auto 0.5rem',
              }}>{num}</div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interactive Demo ── */}
      <section id="try-it" style={{ padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '0.5rem',
          }}>
            Try it right now
          </h2>
          <p style={{
            textAlign: 'center',
            color: 'var(--text-light)',
            marginBottom: '2rem',
            fontSize: '1.0625rem',
          }}>
            Pick something you're into. Watch the lesson change.
          </p>

          {/* Interest picker */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
          }}>
            {DEMO_INTERESTS.map(interest => (
              <button
                key={interest.id}
                onClick={() => handleInterestClick(interest.id)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '9999px',
                  border: selectedInterest === interest.id
                    ? '2px solid var(--primary)'
                    : '2px solid var(--border)',
                  background: selectedInterest === interest.id
                    ? 'rgba(79,70,229,0.08)'
                    : 'var(--surface)',
                  color: selectedInterest === interest.id ? 'var(--primary)' : 'var(--text)',
                  fontWeight: selectedInterest === interest.id ? 600 : 400,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {interest.emoji} {interest.label}
              </button>
            ))}
          </div>

          {/* Lesson card */}
          <div ref={demoRef}>
            {!selectedInterest ? (
              <div className="card" style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                color: 'var(--text-light)',
                border: '2px dashed var(--border)',
                boxShadow: 'none',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                  👆
                </div>
                <p style={{ fontSize: '1.0625rem' }}>
                  Pick an interest above to see how we teach <strong style={{ color: 'var(--text)' }}>{DEMO_CONCEPT}</strong> through something you already love.
                </p>
              </div>
            ) : demo && (
              <div className="card" style={{
                padding: '2rem',
                borderLeft: '4px solid var(--primary)',
                animation: 'fadeIn 0.3s ease',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                }}>
                  <div>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.125rem',
                    }}>
                      Mathematics &middot; Grade 5
                    </div>
                    <h3 style={{ fontSize: '1.375rem', fontWeight: 700 }}>{DEMO_CONCEPT}</h3>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    background: 'rgba(79,70,229,0.1)',
                    color: 'var(--primary)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                  }}>
                    {DEMO_INTERESTS.find(i => i.id === selectedInterest)?.emoji}{' '}
                    {DEMO_INTERESTS.find(i => i.id === selectedInterest)?.label} edition
                  </span>
                </div>

                {/* Lesson text with typewriter */}
                <div style={{
                  fontSize: '1rem',
                  lineHeight: 1.75,
                  color: 'var(--text)',
                  whiteSpace: 'pre-line',
                  marginBottom: '1.5rem',
                  minHeight: '120px',
                }}>
                  {lessonText.split('\n').map((line, i) => (
                    <p key={i} style={{ marginBottom: line.trim() === '' ? '0.75rem' : '0' }}>
                      {renderBold(line)}
                    </p>
                  ))}
                  {!lessonDone && (
                    <span style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '1.1em',
                      background: 'var(--primary)',
                      marginLeft: '2px',
                      animation: 'blink 1s step-end infinite',
                      verticalAlign: 'text-bottom',
                    }} />
                  )}
                </div>

                {/* Quiz section — appears after lesson finishes typing */}
                {lessonDone && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: '1.25rem',
                    animation: 'fadeIn 0.4s ease',
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.5rem',
                    }}>
                      Mastery Check
                    </div>
                    <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                      {demo.problem}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {demo.options.map((opt, i) => {
                        let bg = 'var(--surface)';
                        let border = '1px solid var(--border)';
                        let color = 'var(--text)';

                        if (showResult && i === demo.correct) {
                          bg = 'rgba(34,197,94,0.1)';
                          border = '2px solid var(--success)';
                          color = '#15803d';
                        } else if (showResult && i === quizAnswer && i !== demo.correct) {
                          bg = 'rgba(239,68,68,0.08)';
                          border = '2px solid var(--error)';
                          color = 'var(--error)';
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handleQuizAnswer(i)}
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '0.5rem',
                              border,
                              background: bg,
                              color,
                              fontWeight: 500,
                              fontSize: '1rem',
                              cursor: showResult ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {showResult && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '0.5rem',
                        background: quizAnswer === demo.correct
                          ? 'rgba(34,197,94,0.08)'
                          : 'rgba(239,68,68,0.06)',
                        border: `1px solid ${quizAnswer === demo.correct ? 'var(--success)' : 'var(--error)'}`,
                        fontSize: '0.9375rem',
                        animation: 'fadeIn 0.3s ease',
                      }}>
                        <strong>{quizAnswer === demo.correct ? 'Correct!' : 'Not quite.'}</strong>{' '}
                        {demo.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CTA under demo */}
          {showResult && (
            <div style={{
              textAlign: 'center',
              marginTop: '2rem',
              animation: 'fadeIn 0.4s ease',
            }}>
              <p style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                color: 'var(--text)',
              }}>
                That's Open Alpha. Every concept, personalized to you.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  to="/signup?role=student"
                  className="btn btn-primary"
                  style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}
                >
                  Create free account
                </Link>
                <button
                  onClick={() => navigate('/demo')}
                  className="btn btn-outline"
                  style={{ fontSize: '1rem', padding: '0.75rem 1.75rem' }}
                >
                  Try the full demo
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── The difference ── */}
      <section style={{ padding: '4rem 0', background: 'var(--surface)' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center', marginBottom: '2.5rem' }}>
            Why this is different
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              {
                title: 'Not a chatbot',
                desc: 'No open-ended chat that becomes a cheat-bot. Structured lessons, mastery quizzes, real learning.',
                accent: 'var(--error)',
              },
              {
                title: 'Not static videos',
                desc: 'No one-size-fits-all lectures. AI generates fresh lessons using analogies from YOUR world.',
                accent: '#f59e0b',
              },
              {
                title: 'Mastery, not time served',
                desc: 'You advance when you prove it — not when the clock runs out. Fast learners finish fast.',
                accent: 'var(--primary)',
              },
              {
                title: 'Earn your time back',
                desc: 'Stay focused, finish your academics, and get real free time for passion projects and play.',
                accent: 'var(--success)',
              },
            ].map(({ title, desc, accent }) => (
              <div key={title} className="card" style={{ borderTop: `3px solid ${accent}` }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h4>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9375rem', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How the engine works ── */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '700px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center', marginBottom: '2.5rem' }}>
            Under the hood
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {[
              {
                icon: '🗺️',
                title: 'Open Knowledge Graph',
                desc: 'A community-maintained map of every concept and its prerequisites. Humans define the truth. AI teaches it.',
              },
              {
                icon: '🧠',
                title: 'Generative Mastery Engine',
                desc: 'AI pulls the next unmastered concept, reads your interest profile, and generates a lesson tailored to your brain.',
              },
              {
                icon: '🎯',
                title: 'Zone of Proximal Development',
                desc: 'Quizzes adapt to keep you at 80-85% accuracy — hard enough to grow, easy enough to succeed.',
              },
              {
                icon: '⏱️',
                title: 'Timeback & Waste Meter',
                desc: 'A dashboard that quantifies your focus. Rapid-guessing? It shows. Locked in? You earn time back faster.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{
                  fontSize: '1.5rem',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(79,70,229,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</h4>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.9375rem', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Parents & Schools ── */}
      <section style={{ padding: '4rem 0', background: 'var(--surface)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            maxWidth: '900px',
            margin: '0 auto',
          }}>
            <div className="card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>For Parents</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {[
                  'See exactly what your child has mastered',
                  'Get AI coaching on how to support them',
                  'No access to chat logs — their privacy is respected',
                  'Link your account in seconds with an invite code',
                ].map((item, i) => (
                  <li key={i} style={{
                    paddingLeft: '1.25rem',
                    position: 'relative',
                    marginBottom: '0.75rem',
                    color: 'var(--text-light)',
                    fontSize: '0.9375rem',
                  }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--secondary)' }}>&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup?role=parent"
                className="btn btn-outline"
                style={{ marginTop: '0.5rem', width: '100%', padding: '0.625rem' }}
              >
                Sign up as a parent
              </Link>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>For Schools &amp; Communities</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {[
                  '100% free, open-source, and self-hostable',
                  'API-first — plug your own UI or LMS on top',
                  'Community-maintained curriculum anyone can improve',
                  'Built to complement in-person programs like Alpha School',
                ].map((item, i) => (
                  <li key={i} style={{
                    paddingLeft: '1.25rem',
                    position: 'relative',
                    marginBottom: '0.75rem',
                    color: 'var(--text-light)',
                    fontSize: '0.9375rem',
                  }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--primary)' }}>&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="https://github.com/open-alpha/open-alpha"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ marginTop: '0.5rem', width: '100%', padding: '0.625rem' }}
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{
        padding: '4rem 0',
        textAlign: 'center',
        background: 'linear-gradient(180deg, var(--background) 0%, #eef2ff 100%)',
      }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Ready to learn the way your brain wants to?
          </h2>
          <p style={{
            color: 'var(--text-light)',
            maxWidth: '500px',
            margin: '0 auto 1.5rem',
            fontSize: '1.0625rem',
          }}>
            Pick your interests. Master concepts. Earn your time back. It's that simple.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <Link
                to={user.role === 'student' ? '/dashboard' : '/parent'}
                className="btn btn-primary"
                style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }}
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/signup?role=student"
                  className="btn btn-primary"
                  style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }}
                >
                  Start learning free
                </Link>
                <button
                  onClick={() => navigate('/demo')}
                  className="btn btn-outline"
                  style={{ fontSize: '1.125rem', padding: '0.875rem 2rem' }}
                >
                  Try the demo first
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '1.5rem 0', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="container">
          <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
            Open Alpha — Making quality education accessible to every learner.{' '}
            <a href="/api/curriculum/graph" style={{ color: 'var(--primary)' }}>API</a>
            {' · '}
            <a href="https://github.com/open-alpha/open-alpha" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
