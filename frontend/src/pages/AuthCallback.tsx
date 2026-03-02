import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';

type Status = 'loading' | 'error' | 'no_account';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const called = useRef(false);

  useEffect(() => {
    // Prevent double-invoke in React strict mode
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setErrorMsg(`ATXP returned an error: ${error}`);
      setStatus('error');
      return;
    }

    if (!code || !state) {
      setErrorMsg('Missing authentication parameters. Please try again.');
      setStatus('error');
      return;
    }

    fetch(`/api/auth/atxp-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 404 && data.error === 'no_account') {
          setStatus('no_account');
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || 'Authentication failed');
        }
        login(data.token, data.user);
        navigate(data.user.role === 'student' ? '/dashboard' : '/parent', { replace: true });
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      });
  }, [login, navigate]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-light)' }}>Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (status === 'no_account') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>No account found</h2>
          <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            Your ATXP account isn't linked to Open Alpha yet. Create an account first.
          </p>
          <Link to="/signup" className="btn btn-primary" style={{ display: 'inline-flex', width: '100%', marginBottom: '0.75rem' }}>
            Create an account
          </Link>
          <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Sign in failed</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>{errorMsg}</p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', width: '100%' }}>
          Try again
        </Link>
      </div>
    </div>
  );
}
