import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import Chat from '../components/Chat';
import Quiz from '../components/Quiz';
import LessonIntro from '../components/LessonIntro';
import Spinner from '../components/Spinner';
import ErrorAlert from '../components/ErrorAlert';

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

interface Concept {
  id: string;
  name: string;
  description: string;
  gradeLevel: number;
  masteryScore: number;
  completed: boolean;
  objective?: string;
  explanation?: ConceptExplanation;
  alternateExplanations?: AlternateExplanation[];
  workedExamples?: WorkedExample[];
  whyItMatters?: string;
}

const TUTOR_LEVELS = [
  { id: 'eli5' as const,     label: 'ELI5' },
  { id: 'standard' as const, label: 'Standard' },
  { id: 'expert' as const,   label: 'Expert' },
];
type TutorLevel = typeof TUTOR_LEVELS[number]['id'];

export default function Learn() {
  const { subject, conceptId } = useParams<{ subject: string; conceptId?: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nextConceptBanner, setNextConceptBanner] = useState<Concept | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [chatLevel, setChatLevel] = useState<TutorLevel>('standard');

  async function fetchConcepts() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tutor/concepts/${subject}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load concepts');

      const data = await res.json();
      setConcepts(data.concepts);

      if (conceptId) {
        const concept = data.concepts.find((c: Concept) => c.id === conceptId);
        if (concept) setSelectedConcept(concept);
      } else if (data.concepts.length > 0) {
        const nextRes = await fetch(`/api/tutor/next/${subject}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          if (nextData.concept) {
            setSelectedConcept(nextData.concept);
          } else {
            const uncompleted = data.concepts.find((c: Concept) => !c.completed);
            setSelectedConcept(uncompleted || data.concepts[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch concepts:', err);
      setError(err instanceof Error ? err : new Error('Failed to load concepts'));
    } finally {
      setLoading(false);
    }
  }

  // Only re-fetch when the subject or auth token changes — NOT when the user
  // clicks a different concept. Fetching on every conceptId change races with
  // the lesson-generation flow: the spinner hides the "Writing your lesson..."
  // screen, and if fetchConcepts completes after generation it overwrites the
  // enriched selectedConcept with the un-enriched stub.
  useEffect(() => {
    fetchConcepts();
  }, [subject, token]);

  // Sync selectedConcept when the URL conceptId changes via browser
  // history navigation or a direct link (not a sidebar click, which already
  // calls setSelectedConcept before navigate).
  useEffect(() => {
    if (conceptId && concepts.length > 0) {
      const concept = concepts.find(c => c.id === conceptId);
      if (concept && concept.id !== selectedConcept?.id) {
        setSelectedConcept(concept);
      }
    }
    // selectedConcept intentionally omitted — including it would re-run
    // this after generation enriches the concept, resetting it to the stub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, concepts]);

  useEffect(() => {
    setChatLevel('standard');
  }, [selectedConcept?.id]);

  useEffect(() => {
    setShowQuiz(false);

    if (selectedConcept?.explanation) {
      // Concept already has lesson content — show it
      setShowIntro(true);
      setGeneratingLesson(false);
    } else if (selectedConcept) {
      // Concept is a stub — generate lesson on-demand
      setShowIntro(true);
      setGeneratingLesson(true);

      fetch(`/api/curriculum/lesson?subject=${subject}&concept=${selectedConcept.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.lesson) {
            // Merge the generated lesson content onto the concept
            const enriched: Concept = {
              ...selectedConcept,
              objective: data.lesson.objective,
              explanation: data.lesson.explanation,
              alternateExplanations: data.lesson.alternateExplanations,
              workedExamples: data.lesson.workedExamples,
              whyItMatters: data.lesson.whyItMatters,
            };
            setSelectedConcept(enriched);
            setConcepts(prev => prev.map(c => c.id === enriched.id ? enriched : c));
          }
        })
        .catch(err => {
          console.error('Lesson generation failed:', err);
          // Fall back to tutor chat
          setShowIntro(false);
        })
        .finally(() => {
          setGeneratingLesson(false);
        });
    }
  }, [selectedConcept?.id]);

  const subjectNames: Record<string, string> = {
    math: 'Mathematics',
    algebra1: 'Algebra 1',
    reading: 'Reading & Language Arts',
    science: 'Science',
    'computer-science': 'Computer Science',
    accounting: 'Accounting & Bookkeeping',
    tax: 'Personal Tax & Finance',
    ai: 'Artificial Intelligence',
    marketing: 'Marketing',
  };

  const subjectEmojis: Record<string, string> = {
    math: '📐',
    algebra1: '📐',
    reading: '📖',
    science: '🔬',
    'computer-science': '💻',
    accounting: '📊',
    tax: '🏛️',
    ai: '🤖',
    marketing: '📣',
  };

  const handleQuizComplete = (score: number, passed: boolean) => {
    setShowQuiz(false);

    if (selectedConcept) {
      setSelectedConcept({ ...selectedConcept, masteryScore: score, completed: passed });
      setConcepts(concepts.map((c) =>
        c.id === selectedConcept.id ? { ...c, masteryScore: score, completed: passed } : c
      ));
    }

    if (passed) {
      const currentIndex = concepts.findIndex((c) => c.id === selectedConcept?.id);
      const nextUncompleted = concepts.slice(currentIndex + 1).find((c) => !c.completed);
      if (nextUncompleted) {
        setNextConceptBanner(nextUncompleted);
        setTimeout(() => {
          setNextConceptBanner(null);
          setSelectedConcept(nextUncompleted);
          navigate(`/learn/${subject}/${nextUncompleted.id}`);
        }, 3000);
      }
    }
  };

  // Only show the full-page spinner on the very first load (no concepts yet).
  // After concepts are loaded, switching concepts must NOT re-trigger this
  // spinner — it would hide the "Writing your lesson..." generating screen.
  if (loading && concepts.length === 0) return <Spinner size="large" text="Loading concepts..." />;

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorAlert
          title="Couldn't load concepts"
          message="We had trouble loading the learning content. Please try again."
          error={error}
          onRetry={fetchConcepts}
        />
      </div>
    );
  }

  const hasIntro = !!selectedConcept?.explanation;
  const subjectName = subjectNames[subject || ''] || subject || '';
  const subjectEmoji = subjectEmojis[subject || ''] || '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Breadcrumb bar */}
      <div style={{
        padding: '0.5rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        flexShrink: 0,
      }}>
        {/* Left: mobile lessons button + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lessons-toggle"
          >
            ☰ Lessons
          </button>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', minWidth: 0, overflow: 'hidden' }}>
            <Link
              to="/dashboard"
              style={{ color: 'var(--text-light)', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Subjects
            </Link>
            <span style={{ color: 'var(--border)', flexShrink: 0 }}>›</span>
            <Link
              to={`/learn/${subject}`}
              style={{
                color: selectedConcept ? 'var(--text-light)' : 'var(--text)',
                fontWeight: selectedConcept ? 400 : 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {subjectName}
            </Link>
            {selectedConcept && (
              <>
                <span style={{ color: 'var(--border)', flexShrink: 0 }}>›</span>
                <span style={{
                  color: 'var(--text)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {selectedConcept.name}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Right: Take Quiz */}
        {selectedConcept && !showQuiz && (
          <button
            onClick={() => setShowQuiz(true)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.875rem', flexShrink: 0 }}
          >
            Take Quiz
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Mobile sidebar overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar */}
        <aside
          className={`learn-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            width: '260px',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {/* Subject header */}
          <div style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8rem',
                color: 'var(--text-light)',
                marginBottom: '0.375rem',
              }}
            >
              ← All Subjects
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '1rem' }}>
              <span>{subjectEmoji}</span>
              <span>{subjectName}</span>
            </div>
          </div>

          {/* Concept list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {concepts.map((concept) => (
                <li key={concept.id}>
                  <button
                    onClick={() => {
                      setSelectedConcept(concept);
                      setSidebarOpen(false);
                      navigate(`/learn/${subject}/${concept.id}`);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.75rem',
                      border: 'none',
                      borderRadius: '0.5rem',
                      background: selectedConcept?.id === concept.id ? 'var(--primary)' : 'transparent',
                      color: selectedConcept?.id === concept.id ? 'white' : 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.125rem',
                    }}
                  >
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: concept.completed
                        ? 'var(--success)'
                        : concept.masteryScore > 0
                        ? 'var(--primary)'
                        : selectedConcept?.id === concept.id ? 'rgba(255,255,255,0.3)' : 'var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      color: 'white',
                      flexShrink: 0,
                    }}>
                      {concept.completed ? '✓' : concept.masteryScore > 0 ? '·' : ''}
                    </span>
                    <span style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {concept.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedConcept ? (
            showQuiz ? (
              <Quiz
                subject={subject || ''}
                conceptId={selectedConcept.id}
                conceptName={selectedConcept.name}
                onComplete={handleQuizComplete}
                onCancel={() => setShowQuiz(false)}
              />
            ) : (
              <>
                {/* Concept header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>{selectedConcept.name}</h2>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>{selectedConcept.description}</p>
                  {selectedConcept.masteryScore > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Mastery:</span>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: selectedConcept.completed ? 'var(--success)' : 'var(--primary)',
                        color: 'white',
                      }}>
                        {selectedConcept.masteryScore}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Lesson / Tutor tabs */}
                {(hasIntro || generatingLesson) && (
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface)',
                    padding: '0 1.5rem',
                    flexShrink: 0,
                  }}>
                    {(['lesson', 'tutor'] as const).map((tab) => {
                      const active = (tab === 'lesson') === showIntro;
                      return (
                        <button
                          key={tab}
                          onClick={() => setShowIntro(tab === 'lesson')}
                          style={{
                            padding: '0.625rem 0.25rem',
                            marginRight: '1.5rem',
                            border: 'none',
                            borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                            background: 'transparent',
                            color: active ? 'var(--primary)' : 'var(--text-light)',
                            fontWeight: active ? 600 : 400,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {tab === 'lesson' ? 'Lesson' : 'Tutor'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {generatingLesson ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4rem 2rem',
                      textAlign: 'center',
                      gap: '1.5rem',
                    }}>
                      <div style={{
                        fontSize: '3rem',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}>
                        📝
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                          Writing your lesson...
                        </h3>
                        <p style={{ color: 'var(--text-light)', maxWidth: '400px', lineHeight: 1.6 }}>
                          Our AI is crafting a personalized lesson on <strong>{selectedConcept.name}</strong>. This takes a few seconds the first time — after that, it's instant for everyone.
                        </p>
                      </div>
                      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }`}</style>
                    </div>
                  ) : showIntro && hasIntro ? (
                    <LessonIntro
                      objective={selectedConcept.objective}
                      explanation={selectedConcept.explanation!}
                      alternateExplanations={selectedConcept.alternateExplanations}
                      workedExamples={selectedConcept.workedExamples}
                      whyItMatters={selectedConcept.whyItMatters}
                      onStartChat={() => setShowIntro(false)}
                    />
                  ) : (
                    <>
                      <div style={{
                        padding: '0.625rem 1.5rem',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>Explain like I'm:</span>
                        {TUTOR_LEVELS.map(level => (
                          <button
                            key={level.id}
                            onClick={() => setChatLevel(level.id)}
                            style={{
                              padding: '0.3rem 0.75rem',
                              borderRadius: '9999px',
                              border: '1px solid var(--border)',
                              background: chatLevel === level.id ? 'var(--primary)' : 'transparent',
                              color: chatLevel === level.id ? 'white' : 'var(--text)',
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                      <Chat subject={subject || ''} conceptId={selectedConcept.id} explanationLevel={chatLevel} />
                    </>
                  )}
                </div>
              </>
            )
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-light)' }}>Select a lesson from the left to start learning</p>
            </div>
          )}
        </main>
      </div>

      {/* Auto-advance banner */}
      {nextConceptBanner && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--success)',
          color: 'white',
          padding: '0.875rem 1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9375rem',
          fontWeight: 500,
          zIndex: 1000,
          animation: 'slideUp 0.25s ease-out',
          whiteSpace: 'nowrap',
        }}>
          <span>&#10003;</span>
          <span>Nice work! Moving on to <strong>{nextConceptBanner.name}</strong>...</span>
        </div>
      )}
    </div>
  );
}
