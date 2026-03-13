import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import Spinner from '../components/Spinner';
import ErrorAlert from '../components/ErrorAlert';

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  completed: number;
  inProgress: number;
  notStarted: number;
  totalConcepts: number;
  percentComplete: number;
}

interface Activity {
  subject: string;
  concept_id: string;
  mastery_score: number;
  last_attempt_at: string;
}

interface ReviewItem {
  subject: string;
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  daysSince: number;
}

export default function StudentDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SubjectSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  async function fetchData() {
    setError(null);
    setLoading(true);
    try {
      const [summaryRes, activityRes, reviewRes] = await Promise.all([
        fetch('/api/progress/summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/progress/activity/recent', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/progress/review', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!summaryRes.ok || !activityRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const summaryData = await summaryRes.json();
      const activityData = await activityRes.json();
      const reviewData = reviewRes.ok ? await reviewRes.json() : { review: [] };

      setSummary(summaryData.summary);
      setRecentActivity(activityData.recentProgress || []);
      setReviewQueue(reviewData.review || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [token]);

  async function generateInviteCode() {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/parent/generate-invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setInviteCode(data.inviteCode);
      }
    } catch (err) {
      console.error('Failed to generate invite code:', err);
    } finally {
      setGeneratingCode(false);
    }
  }

  function copyInviteCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
    }
  }

  const subjectEmojis: Record<string, string> = {
    math: '📐',
    reading: '📚',
    science: '🔬',
  };

  if (loading) {
    return <Spinner size="large" text="Loading your progress..." />;
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorAlert
          title="Couldn't load your dashboard"
          message="We had trouble loading your progress. Please try again."
          error={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!
        </h2>

        {/* Spaced Repetition: Due for Review */}
        {reviewQueue.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Due for Review</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.125rem 0.5rem', background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', borderRadius: '9999px' }}>
                {reviewQueue.length}
              </span>
            </h3>
            <div className="card" style={{ padding: '0.25rem 0' }}>
              {reviewQueue.map((item, i) => (
                <div
                  key={item.conceptId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 1rem',
                    borderBottom: i < reviewQueue.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{subjectEmojis[item.subject]}</span>
                    <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{item.conceptName}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)' }}>
                      · {item.daysSince}d ago
                    </span>
                  </div>
                  <Link
                    to={`/learn/${item.subject}/${item.conceptId}`}
                    className="btn btn-outline"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }}
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subject Cards */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Choose a Subject</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {summary.map((subject) => (
              <div
                key={subject.subjectId}
                className="card"
                style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                onClick={() => navigate(`/learn/${subject.subjectId}`)}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>{subjectEmojis[subject.subjectId]}</span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{subject.subjectName}</h4>
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
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                    {subject.completed} completed · {subject.inProgress} in progress · {subject.notStarted} to go
                  </p>
                  <Link
                    to={`/map/${subject.subjectId}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: '0.8125rem', color: 'var(--primary)', whiteSpace: 'nowrap', marginLeft: '0.75rem' }}
                  >
                    View map →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>No activity yet. Start learning to see your progress!</p>
          ) : (
            <div className="card">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <li
                    key={index}
                    className="activity-item"
                    style={{
                      padding: '0.75rem 0',
                      borderBottom: index < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ marginRight: '0.5rem' }}>{subjectEmojis[activity.subject]}</span>
                      <span style={{ fontWeight: 500 }}>{activity.concept_id.replace(`${activity.subject}-`, '').replace(/-/g, ' ')}</span>
                    </div>
                    <div className="activity-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: activity.mastery_score >= 80 ? 'var(--success)' : 'var(--primary)',
                          color: 'white',
                        }}
                      >
                        {activity.mastery_score}%
                      </span>
                      <Link
                        to={`/learn/${activity.subject}/${activity.concept_id}`}
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Continue
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Parent Link Section */}
        <section>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Connect a Parent</h3>
          <div className="card">
            <p style={{ color: 'var(--text-light)', marginBottom: '1rem' }}>
              Want your parent to see your progress? Generate a code for them to link their account.
            </p>
            {inviteCode ? (
              <div className="invite-code-display" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'var(--background)',
                    borderRadius: '0.5rem',
                    fontFamily: 'monospace',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                  }}
                >
                  {inviteCode}
                </div>
                <button onClick={copyInviteCode} className="btn btn-secondary">
                  Copy
                </button>
              </div>
            ) : (
              <button
                onClick={generateInviteCode}
                className="btn btn-primary"
                disabled={generatingCode}
              >
                {generatingCode ? 'Generating...' : 'Generate Invite Code'}
              </button>
            )}
            {inviteCode && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginTop: '0.75rem' }}>
                Share this code with your parent. It can only be used once.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
