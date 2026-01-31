import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const dashboardPath = isStudent ? '/dashboard' : '/parent';

  // Don't show on landing or login pages
  if (!user) return null;

  const gradeLabels: Record<number, string> = {
    0: 'K',
    1: '1st',
    2: '2nd',
    3: '3rd',
    4: '4th',
    5: '5th',
    6: '6th',
    7: '7th',
    8: '8th',
    9: '9th',
    10: '10th',
    11: '11th',
    12: '12th',
  };

  return (
    <header
      style={{
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Logo/Home */}
        <Link
          to={dashboardPath}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: 'var(--primary)',
            fontWeight: 700,
            fontSize: '1.25rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>📚</span>
          <span className="hide-mobile">Open Alpha</span>
        </Link>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isStudent && (
            <>
              <NavLink to="/dashboard" current={location.pathname === '/dashboard'}>
                <span style={{ fontSize: '1.1rem' }}>🏠</span>
                <span className="hide-mobile">Dashboard</span>
              </NavLink>
              <NavLink to="/settings" current={location.pathname === '/settings'}>
                <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                <span className="hide-mobile">Settings</span>
              </NavLink>
            </>
          )}

          {isParent && (
            <>
              <NavLink to="/parent" current={location.pathname === '/parent'}>
                <span style={{ fontSize: '1.1rem' }}>🏠</span>
                <span className="hide-mobile">Dashboard</span>
              </NavLink>
              <NavLink to="/parent/coach" current={location.pathname === '/parent/coach'}>
                <span style={{ fontSize: '1.1rem' }}>💬</span>
                <span className="hide-mobile">Coach</span>
              </NavLink>
            </>
          )}

          {/* User info & logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginLeft: '0.5rem',
              paddingLeft: '0.75rem',
              borderLeft: '1px solid var(--border)',
            }}
          >
            <span className="hide-mobile" style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
              {user?.displayName || user?.email?.split('@')[0]}
              {isStudent && user?.gradeLevel !== null && ` · ${gradeLabels[user.gradeLevel]}`}
            </span>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem',
                cursor: 'pointer',
                color: 'var(--text-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
              }}
              title="Sign Out"
            >
              <span style={{ fontSize: '1.1rem' }}>🚪</span>
              <span className="hide-mobile">Sign Out</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  to,
  current,
  children,
}: {
  to: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.5rem',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: current ? 'var(--primary)' : 'var(--text)',
        background: current ? 'var(--primary-light, rgba(37, 99, 235, 0.1))' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </Link>
  );
}
