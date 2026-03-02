import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function Login() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={user.role === 'student' ? '/dashboard' : '/parent'} replace />;
  }

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/atxp-initiate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start sign in');
      }
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <Link to="/">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>Open Alpha</h1>
        </Link>
        <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>Free AI tutoring for K–12 students</p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '1.5rem', gap: '0.5rem' }}
        >
          {loading ? 'Redirecting...' : 'Sign in with ATXP'}
        </button>

        {error && <p className="error-message" style={{ marginBottom: '1rem' }}>{error}</p>}

        <p style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
          New to Open Alpha?{' '}
          <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
