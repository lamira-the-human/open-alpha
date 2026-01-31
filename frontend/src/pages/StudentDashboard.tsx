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

export default function StudentDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SubjectSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  async function fetchData() {
    setError(null);
    setLoading(true);
    try {
      const [summaryRes, activityRes] = await Promise.all([
        fetch('/api/progress/summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/progress/activity/recent', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!summaryRes.ok || !activityRes.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const summaryData = await summaryRes.json();
      const activityData = await activityRes.json();

      setSummary(summaryData.summary);
      setRecentActivity(activityData.recentProgress || []);
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
      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="container mobile-header">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Open Alpha</h1>
          <div className="mobile-header-actions">
            <span className="desktop-user-info" style={{ color: 'var(--text-light)' }}>
              {user?.displayName || user?.email} · {gradeLabels[user?.gradeLevel || 0]}
            </span>
            <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
              Sign Out
            </button>
          </div>
          <div className="mobile-user-info">
            {user?.displayName || user?.email} · {gradeLabels[user?.gradeLevel || 0]}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!
        </h2>

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

                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
                  {subject.completed} completed · {subject.inProgress} in progress · {subject.notStarted} to go
                </p>
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
