import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';

type Step = 'age' | 'role';
type Role = 'student' | 'parent';

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
  15: 'Adult Learner',
};

function Under13Screen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(79,70,229,0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem', fontSize: '1.75rem'
        }}>
          👋
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          A parent needs to set up your account
        </h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Open Alpha is free for students of all ages, but kids under 13 need a parent or guardian to create the account.
        </p>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem', lineHeight: 1.6 }}>
          Ask a parent to visit <strong>open-alpha-eta.vercel.app</strong>, click <strong>Create an account</strong>, and select <strong>Parent</strong>. They can link your learning account from their dashboard.
        </p>
        <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex', width: '100%' }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function Signup() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('age');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [showUnder13, setShowUnder13] = useState(false);
  const [role, setRole] = useState<Role>((searchParams.get('role') as Role) || 'student');
  const [gradeLevel, setGradeLevel] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={user.role === 'student' ? '/dashboard' : '/parent'} replace />;
  }

  if (showUnder13) {
    return <Under13Screen />;
  }

  const handleAgeSubmit = () => {
    if (!ageConfirmed) {
      setShowUnder13(true);
      return;
    }
    setStep('role');
  };

  const handleContinueWithATXP = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/atxp-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          gradeLevel: role === 'student' ? gradeLevel : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start sign up');
      }
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <Link to="/" style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Open Alpha</h1>
        </Link>

        {step === 'age' && (
          <>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Before we begin</h2>
            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Open Alpha requires an ATXP account. ATXP accounts are for users 13 and older.
            </p>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                style={{ marginTop: '0.2rem', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                I confirm I am <strong>13 years of age or older</strong>
              </span>
            </label>

            <button onClick={handleAgeSubmit} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
              Continue
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-light)' }}>
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </>
        )}

        {step === 'role' && (
          <>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Who are you?</h2>
            <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              This helps us personalize your experience.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`btn ${role === 'student' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1 }}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={`btn ${role === 'parent' ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1 }}
              >
                Parent
              </button>
            </div>

            {role === 'student' && (
              <div className="form-group">
                <label htmlFor="gradeLevel">Your level</label>
                <select
                  id="gradeLevel"
                  className="input"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(parseInt(e.target.value, 10))}
                >
                  {Object.entries(gradeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="error-message">{error}</p>}

            <button
              onClick={handleContinueWithATXP}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? 'Redirecting...' : 'Continue with ATXP'}
            </button>

            <button
              type="button"
              onClick={() => setStep('age')}
              style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '1rem', display: 'block', width: '100%', cursor: 'pointer' }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
