import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import Spinner from '../components/Spinner';
import ErrorAlert from '../components/ErrorAlert';

interface Child {
  id: number;
  email: string;
  display_name: string | null;
  grade_level: number;
  linked_at: string;
}

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  completed: number;
  inProgress: number;
  totalConcepts: number;
  percentComplete: number;
}

interface Activity {
  session_type: string;
  subject: string | null;
  concept_id: string | null;
  updated_at: string;
}

interface Struggling {
  subject: string;
  concept_id: string;
  conceptName: string;
  subjectName: string;
  mastery_score: number;
  attempts: number;
}

interface Recommendation {
  type: 'continue' | 'review' | 'start';
  subject: string;
  conceptId: string;
  conceptName: string;
  reason: string;
}

interface Analytics {
  lastActive: string | null;
  recentActivity: Activity[];
  struggling: Struggling[];
  recommendations: Recommendation[];
}

export default function ParentDashboard() {
  const { user, logout, token } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [childProgress, setChildProgress] = useState<SubjectSummary[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function fetchData() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/parent/children', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load dashboard');
      }

      const data = await res.json();
      setChildren(data.children);
      if (data.children.length > 0 && !selectedChild) {
        setSelectedChild(data.children[0]);
      }
    } catch (err) {
      console.error('Failed to fetch children:', err);
      setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildProgress(selectedChild.id);
      fetchChildAnalytics(selectedChild.id);
    }
  }, [selectedChild, token]);

  async function fetchChildProgress(childId: number) {
    try {
      const res = await fetch(`/api/parent/children/${childId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setChildProgress(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch child progress:', error);
    }
  }

  async function fetchChildAnalytics(childId: number) {
    try {
      const res = await fetch(`/api/parent/children/${childId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch child analytics:', error);
    }
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  async function handleLinkChild() {
    setLinkError('');
    try {
      const res = await fetch('/api/parent/link', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: linkCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to link');
      }

      setLinkCode('');
      fetchData();
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Failed to link');
    }
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

  const subjectEmojis: Record<string, string> = {
    math: '📐',
    reading: '📚',
    science: '🔬',
  };

  if (loading) {
    return <Spinner size="large" text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorAlert
          title="Couldn't load your dashboard"
          message="We had trouble loading your data. Please try again."
          error={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container mobile-header">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Open Alpha</h1>
          <div className="mobile-header-actions parent-header-actions">
            <Link to="/parent/coach" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              Parent Coach
            </Link>
            <span className="desktop-user-info" style={{ color: 'var(--text-light)' }}>{user?.displayName || user?.email}</span>
            <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
              Sign Out
            </button>
          </div>
          <div className="mobile-user-info">
            {user?.displayName || user?.email}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>Parent Dashboard</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Children List */}
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Your Children</h3>

            {children.length === 0 ? (
              <div className="card">
                <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
                  No children linked yet. Ask your child to generate an invite code from their account.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: selectedChild?.id === child.id ? '2px solid var(--primary)' : 'none',
                    }}
                    onClick={() => setSelectedChild(child)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>{child.display_name || child.email}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                          {gradeLabels[child.grade_level]}
                        </p>
                      </div>
                      {selectedChild?.id === child.id && (
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Selected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Link New Child */}
            <div className="card">
              <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Link a Child</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
                Enter the 8-character invite code from your child's account.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="ABCD1234"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleLinkChild}
                  className="btn btn-primary"
                  disabled={linkCode.length !== 8}
                >
                  Link
                </button>
              </div>
              {linkError && <p className="error-message">{linkError}</p>}
            </div>
          </div>

          {/* Child Progress & Analytics */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedChild
                  ? `${selectedChild.display_name || selectedChild.email}'s Progress`
                  : 'Select a Child'}
              </h3>
              {analytics?.lastActive && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                  Last active: {formatRelativeTime(analytics.lastActive)}
                </span>
              )}
            </div>

            {selectedChild ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Struggling Alerts */}
                {analytics?.struggling && analytics.struggling.length > 0 && (
                  <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--error)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--error)' }}>
                      Needs Extra Help
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {analytics.struggling.map((item, index) => (
                        <li
                          key={index}
                          style={{
                            padding: '0.5rem 0',
                            borderBottom: index < analytics.struggling.length - 1 ? '1px solid var(--border)' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500 }}>{item.conceptName}</span>
                            <span style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                              ({item.subjectName})
                            </span>
                          </div>
                          <span style={{ fontSize: '0.875rem', color: 'var(--error)' }}>
                            {item.attempts} attempts, {item.mastery_score}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {analytics?.recommendations && analytics.recommendations.length > 0 && (
                  <div className="card" style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid var(--success)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--success)' }}>
                      Recommended Next Steps
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {analytics.recommendations.map((rec, index) => (
                        <li
                          key={index}
                          style={{
                            padding: '0.5rem 0',
                            borderBottom: index < analytics.recommendations.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: rec.type === 'continue' ? 'var(--primary)' : rec.type === 'start' ? 'var(--secondary)' : 'var(--text-light)',
                              color: 'white',
                            }}>
                              {rec.type === 'continue' ? 'Continue' : rec.type === 'start' ? 'Start' : 'Review'}
                            </span>
                            <span style={{ fontWeight: 500 }}>{rec.conceptName}</span>
                          </div>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                            {rec.reason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Subject Progress */}
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Subject Progress</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {childProgress.map((subject) => (
                      <div key={subject.subjectId} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{subjectEmojis[subject.subjectId]}</span>
                          <h4 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{subject.subjectName}</h4>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>Progress</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{subject.percentComplete}%</span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${subject.percentComplete}%`,
                                background: 'var(--secondary)',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>

                        <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                          {subject.completed} of {subject.totalConcepts} concepts mastered
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                {analytics?.recentActivity && analytics.recentActivity.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Recent Activity</h4>
                    <div className="card">
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {analytics.recentActivity.map((activity, index) => (
                          <li
                            key={index}
                            style={{
                              padding: '0.5rem 0',
                              borderBottom: index < analytics.recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {activity.subject && (
                                <span style={{ fontSize: '1.25rem' }}>{subjectEmojis[activity.subject]}</span>
                              )}
                              <span style={{ fontWeight: 500 }}>
                                {activity.session_type === 'tutor' ? 'Learning session' : 'Coach chat'}
                              </span>
                              {activity.concept_id && (
                                <span style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
                                  - {activity.concept_id.replace(/^\w+-/, '').replace(/-/g, ' ')}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                              {formatRelativeTime(activity.updated_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {childProgress.every((s) => s.completed === 0) && !analytics?.recentActivity?.length && (
                  <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '2rem' }}>
                    Your child hasn't started learning yet. Encourage them to pick a subject!
                  </p>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-light)' }}>
                  Link a child to view their learning progress.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
