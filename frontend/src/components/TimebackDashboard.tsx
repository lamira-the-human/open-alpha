import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import WasteMeter from './WasteMeter';

interface TimebackData {
  today: {
    totalActiveMinutes: number;
    lessonMinutes: number;
    quizMinutes: number;
    conceptsStudied: number;
    totalAnswers: number;
    correctAnswers: number;
    hintRequests: number;
  };
  wasteMeter: {
    score: number;
    focusScore: number;
    rapidGuessCount: number;
    idleTimeouts: number;
  };
  timeback: {
    dailyProgress: number;
    targetMinutes: number;
    effectiveMinutes: number;
    timebackMinutes: number;
    efficiencyMultiplier: number;
  };
  recentAccuracy: number | null;
}

export default function TimebackDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<TimebackData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/progress/timeback', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently fail — not critical
      }
    }
    load();
    // Refresh every 60 seconds while the component is mounted
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [token]);

  if (!data) return null;

  const { today, wasteMeter, timeback } = data;
  const isDone = timeback.dailyProgress >= 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Timeback Progress */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>
            {isDone ? 'You earned your time back!' : 'Earn Your Time Back'}
          </h3>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            background: isDone ? 'var(--success)' : 'var(--primary)',
            color: 'white',
          }}>
            {timeback.dailyProgress}%
          </span>
        </div>

        {/* Progress bar showing how close to "done" */}
        <div style={{ height: '12px', background: 'var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem' }}>
          <div style={{
            height: '100%',
            width: `${timeback.dailyProgress}%`,
            background: isDone
              ? 'linear-gradient(90deg, var(--success), #34d399)'
              : 'linear-gradient(90deg, var(--primary), #818cf8)',
            borderRadius: '6px',
            transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-light)' }}>
          <span>{today.totalActiveMinutes} min focused today</span>
          <span>
            {isDone
              ? `${timeback.timebackMinutes} min earned back`
              : `${timeback.targetMinutes - timeback.effectiveMinutes} min remaining`}
          </span>
        </div>

        {timeback.efficiencyMultiplier > 1 && (
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--success)',
            fontWeight: 500,
          }}>
            1.25x focus bonus active — finishing faster!
          </div>
        )}
      </div>

      {/* Waste Meter */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <WasteMeter
          wasteScore={wasteMeter.score}
          focusScore={wasteMeter.focusScore}
          rapidGuessCount={wasteMeter.rapidGuessCount}
          idleTimeouts={wasteMeter.idleTimeouts}
        />
      </div>

      {/* Today's Stats */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '0.875rem 1rem', flex: '1 1 120px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{today.conceptsStudied}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>concepts today</div>
        </div>
        <div className="card" style={{ padding: '0.875rem 1rem', flex: '1 1 120px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
            {today.totalAnswers > 0 ? Math.round((today.correctAnswers / today.totalAnswers) * 100) : 0}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>accuracy</div>
        </div>
        <div className="card" style={{ padding: '0.875rem 1rem', flex: '1 1 120px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{today.hintRequests}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>hints used</div>
        </div>
      </div>
    </div>
  );
}
