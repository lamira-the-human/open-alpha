import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import Chat from '../components/Chat';
import Quiz from '../components/Quiz';
import Spinner from '../components/Spinner';
import ErrorAlert from '../components/ErrorAlert';

interface Concept {
  id: string;
  name: string;
  description: string;
  gradeLevel: number;
  masteryScore: number;
  completed: boolean;
}

export default function Learn() {
  const { subject, conceptId } = useParams<{ subject: string; conceptId?: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function fetchConcepts() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tutor/concepts/${subject}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load concepts');
      }

      const data = await res.json();
      setConcepts(data.concepts);

      // If conceptId is provided, select that concept
      if (conceptId) {
        const concept = data.concepts.find((c: Concept) => c.id === conceptId);
        if (concept) {
          setSelectedConcept(concept);
        }
      } else if (data.concepts.length > 0) {
        // Otherwise find the next recommended concept
        const nextRes = await fetch(`/api/tutor/next/${subject}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (nextRes.ok) {
          const nextData = await nextRes.json();
          if (nextData.concept) {
            setSelectedConcept(nextData.concept);
          } else {
            // All done - select first uncompleted or first
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

  useEffect(() => {
    fetchConcepts();
  }, [subject, conceptId, token]);

  const subjectNames: Record<string, string> = {
    math: 'Mathematics',
    reading: 'Reading & Language Arts',
    science: 'Science',
  };

  const handleQuizComplete = (score: number, passed: boolean) => {
    setShowQuiz(false);

    // Update local state
    if (selectedConcept) {
      setSelectedConcept({ ...selectedConcept, masteryScore: score, completed: passed });
      setConcepts(
        concepts.map((c) =>
          c.id === selectedConcept.id ? { ...c, masteryScore: score, completed: passed } : c
        )
      );
    }

    // If passed, suggest moving to next concept
    if (passed) {
      const currentIndex = concepts.findIndex((c) => c.id === selectedConcept?.id);
      const nextUncompleted = concepts.slice(currentIndex + 1).find((c) => !c.completed);
      if (nextUncompleted) {
        setTimeout(() => {
          if (window.confirm(`Great job! Ready to move on to "${nextUncompleted.name}"?`)) {
            setSelectedConcept(nextUncompleted);
            navigate(`/learn/${subject}/${nextUncompleted.id}`);
          }
        }, 1000);
      }
    }
  };

  if (loading) {
    return <Spinner size="large" text="Loading concepts..." />;
  }

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/dashboard" style={{ color: 'var(--text-light)', textDecoration: 'none' }}>
              ← Back
            </Link>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{subjectNames[subject || '']}</h1>
          </div>
          {selectedConcept && (
            <button
              onClick={() => setShowQuiz(true)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Take Quiz
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mobile sidebar overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar - Concept List */}
        <aside
          className={`learn-sidebar ${sidebarOpen ? 'open' : ''}`}
          style={{
            width: '280px',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: '0.75rem' }}>
              CONCEPTS
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {concepts.map((concept) => (
                <li key={concept.id}>
                  <button
                    onClick={() => {
                      setSelectedConcept(concept);
                      setShowQuiz(false);
                      setSidebarOpen(false);
                      navigate(`/learn/${subject}/${concept.id}`);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '0.5rem',
                      background: selectedConcept?.id === concept.id ? 'var(--primary)' : 'transparent',
                      color: selectedConcept?.id === concept.id ? 'white' : 'var(--text)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: concept.completed
                          ? 'var(--success)'
                          : concept.masteryScore > 0
                          ? 'var(--primary)'
                          : 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {concept.completed ? '✓' : concept.masteryScore > 0 ? Math.round(concept.masteryScore / 20) : ''}
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
                {/* Concept Header */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>{selectedConcept.name}</h2>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>{selectedConcept.description}</p>
                  {selectedConcept.masteryScore > 0 && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Mastery:</span>
                      <span
                        style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: selectedConcept.completed ? 'var(--success)' : 'var(--primary)',
                          color: 'white',
                        }}
                      >
                        {selectedConcept.masteryScore}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Chat Interface */}
                <Chat subject={subject || ''} conceptId={selectedConcept.id} />
              </>
            )
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-light)' }}>Select a concept to start learning</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile sidebar toggle button */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close concept list' : 'Open concept list'}
      >
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>
    </div>
  );
}
