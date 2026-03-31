import { useState, useEffect } from 'react';
import { useAuth } from '../App';

interface Interest {
  id?: number;
  category: string;
  value: string;
  weight?: number;
}

const CATEGORIES = [
  { id: 'sport', label: 'Sports', placeholder: 'e.g., Baseball, Soccer, Basketball' },
  { id: 'hobby', label: 'Hobbies', placeholder: 'e.g., Drawing, Cooking, Gaming' },
  { id: 'media', label: 'Movies / Shows / Games', placeholder: 'e.g., Minecraft, Marvel, Harry Potter' },
  { id: 'hero', label: 'Heroes / Role Models', placeholder: 'e.g., Simone Biles, Elon Musk, a parent' },
  { id: 'career', label: 'Dream Career', placeholder: 'e.g., Doctor, Game Designer, Astronaut' },
  { id: 'other', label: 'Other Interests', placeholder: 'e.g., Dinosaurs, Space, Music' },
];

interface Props {
  onComplete?: () => void;
  compact?: boolean;
}

export default function InterestSetup({ onComplete, compact = false }: Props) {
  const { token } = useAuth();
  const [interests, setInterests] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/interests', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, string> = {};
          for (const interest of data.interests) {
            if (map[interest.category]) {
              map[interest.category] += ', ' + interest.value;
            } else {
              map[interest.category] = interest.value;
            }
          }
          setInterests(map);
        }
      } catch {
        // Ignore — just start with empty
      }
      setLoaded(true);
    }
    load();
  }, [token]);

  async function handleSave() {
    setSaving(true);
    try {
      const interestList: Interest[] = [];
      for (const [category, valueStr] of Object.entries(interests)) {
        const values = valueStr.split(',').map(v => v.trim()).filter(Boolean);
        for (const value of values) {
          interestList.push({ category, value });
        }
      }

      await fetch('/api/interests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interests: interestList }),
      });

      onComplete?.();
    } catch (err) {
      console.error('Failed to save interests:', err);
    } finally {
      setSaving(false);
    }
  }

  const hasAnyInterest = Object.values(interests).some(v => v.trim().length > 0);

  if (!loaded) return null;

  return (
    <div className="card" style={{ maxWidth: compact ? '100%' : '600px', margin: compact ? 0 : '0 auto' }}>
      {!compact && (
        <>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Tell us what you love
          </h3>
          <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
            We'll use your interests to make lessons more fun. Love baseball? We'll teach math through batting averages. Into Minecraft? We'll use blocks to explain fractions.
          </p>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {CATEGORIES.map(cat => (
          <div key={cat.id}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              {cat.label}
            </label>
            <input
              type="text"
              value={interests[cat.id] || ''}
              onChange={e => setInterests(prev => ({ ...prev, [cat.id]: e.target.value }))}
              placeholder={cat.placeholder}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                background: 'var(--background)',
                outline: 'none',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        {onComplete && (
          <button
            onClick={onComplete}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1.25rem' }}
          >
            Skip for now
          </button>
        )}
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={saving || !hasAnyInterest}
          style={{ padding: '0.5rem 1.25rem' }}
        >
          {saving ? 'Saving...' : 'Save Interests'}
        </button>
      </div>
    </div>
  );
}
