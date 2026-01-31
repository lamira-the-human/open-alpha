import { useState } from 'react';
import { useAuth } from '../App';

export default function Settings() {
  const { user, token, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [gradeLevel, setGradeLevel] = useState(user?.gradeLevel ?? 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const gradeOptions = [
    { value: 0, label: 'Kindergarten' },
    { value: 1, label: '1st Grade' },
    { value: 2, label: '2nd Grade' },
    { value: 3, label: '3rd Grade' },
    { value: 4, label: '4th Grade' },
    { value: 5, label: '5th Grade' },
    { value: 6, label: '6th Grade' },
    { value: 7, label: '7th Grade' },
    { value: 8, label: '8th Grade' },
    { value: 9, label: '9th Grade' },
    { value: 10, label: '10th Grade' },
    { value: 11, label: '11th Grade' },
    { value: 12, label: '12th Grade' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName || null,
          gradeLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const updatedUser = await res.json();
      updateUser(updatedUser);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 1rem', maxWidth: '600px' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Edit Profile</h2>

          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                color: '#b91c1c',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: '#dcfce7',
                border: '1px solid #22c55e',
                borderRadius: '0.5rem',
                color: '#15803d',
                marginBottom: '1rem',
              }}
            >
              Changes saved successfully!
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="displayName"
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
              >
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                }}
              />
            </div>

            {user?.role === 'student' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="gradeLevel"
                  style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
                >
                  Grade Level
                </label>
                <select
                  id="gradeLevel"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: 'white',
                  }}
                >
                  {gradeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                  This determines which concepts you'll start with. If the material seems too easy or too hard, adjust your grade level.
                </p>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Info section */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>About Grade Levels</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
            When you start a new subject, we'll begin with concepts appropriate for your grade level.
            You won't have to prove you can count before learning fractions!
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', lineHeight: 1.6, marginTop: '0.5rem' }}>
            If you want to review earlier material, you can always go back to any concept in the learning view.
          </p>
        </div>
      </main>
    </div>
  );
}
