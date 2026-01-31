import { Link } from 'react-router-dom';
import { useAuth } from '../App';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Open Alpha</h1>
          <nav>
            {user ? (
              <Link to={user.role === 'student' ? '/dashboard' : '/parent'} className="btn btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn btn-primary">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="container">
          <h2 className="hero-title" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
            AI-Powered Learning for K-12
          </h2>
          <p className="hero-subtitle" style={{ fontSize: '1.25rem', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Personalized tutoring that adapts to every student. Math, Reading, and Science - from kindergarten through high school.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/login?role=student" className="btn btn-primary" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}>
              Start Learning
            </Link>
            <Link to="/login?role=parent" className="btn btn-outline" style={{ fontSize: '1.125rem', padding: '1rem 2rem' }}>
              Parent Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '4rem 0', background: 'var(--surface)' }}>
        <div className="container">
          <h3 style={{ fontSize: '2rem', fontWeight: 600, textAlign: 'center', marginBottom: '3rem' }}>
            How It Works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>1</div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Choose Your Subject</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Pick from Math, Reading, or Science. Content adapts to your grade level.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>2</div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Learn with AI</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Chat with your personal AI tutor. Ask questions, get explanations, practice problems.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>3</div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Master Concepts</h4>
              <p style={{ color: 'var(--text-light)' }}>
                Take checkpoint quizzes. Score 80% or higher to advance to new topics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Parents */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>For Parents</h3>
              <ul style={{ listStyle: 'none', padding: 0, color: 'var(--text-light)' }}>
                <li style={{ marginBottom: '1rem', paddingLeft: '1.5rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--secondary)' }}>✓</span>
                  View your child's progress in real-time
                </li>
                <li style={{ marginBottom: '1rem', paddingLeft: '1.5rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--secondary)' }}>✓</span>
                  See which concepts they've mastered
                </li>
                <li style={{ marginBottom: '1rem', paddingLeft: '1.5rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--secondary)' }}>✓</span>
                  Get AI coaching on how to support their learning
                </li>
                <li style={{ paddingLeft: '1.5rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--secondary)' }}>✓</span>
                  Access activities to reinforce learning at home
                </li>
              </ul>
            </div>
            <div className="card" style={{ background: 'var(--primary)', color: 'white' }}>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Parent AI Coach</h4>
              <p style={{ marginBottom: '1rem', opacity: 0.9 }}>
                Get personalized guidance on supporting your child's education journey. Our AI coach helps you understand what your child is learning and how to help at home.
              </p>
              <Link to="/login?role=parent" style={{ color: 'white', fontWeight: 600 }}>
                Try Parent Coach →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '2rem 0', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <div className="container">
          <p style={{ color: 'var(--text-light)' }}>
            Open Alpha - Making quality education accessible to every student
          </p>
        </div>
      </footer>
    </div>
  );
}
