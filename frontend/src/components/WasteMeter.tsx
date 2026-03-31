interface Props {
  wasteScore: number;
  focusScore: number;
  rapidGuessCount: number;
  idleTimeouts: number;
}

export default function WasteMeter({ focusScore, rapidGuessCount, idleTimeouts }: Props) {
  // Color gradient from green (focused) to red (waste)
  const getColor = (focus: number) => {
    if (focus >= 80) return 'var(--success)';
    if (focus >= 60) return '#f59e0b'; // amber
    return 'var(--error)';
  };

  const color = getColor(focusScore);
  const label = focusScore >= 80 ? 'Locked In' : focusScore >= 60 ? 'Stay Focused' : 'Too Much Waste';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Focus Meter</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color }}>{label}</span>
      </div>

      {/* Main bar */}
      <div style={{ height: '10px', background: 'var(--border)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${focusScore}%`,
          background: color,
          borderRadius: '5px',
          transition: 'width 0.5s ease, background 0.3s ease',
        }} />
      </div>

      {/* Detail chips */}
      {(rapidGuessCount > 0 || idleTimeouts > 0) && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {rapidGuessCount > 0 && (
            <span style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              background: 'rgba(239,68,68,0.1)',
              color: 'var(--error)',
            }}>
              {rapidGuessCount} rapid guess{rapidGuessCount !== 1 ? 'es' : ''}
            </span>
          )}
          {idleTimeouts > 0 && (
            <span style={{
              fontSize: '0.75rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              background: 'rgba(245,158,11,0.1)',
              color: '#f59e0b',
            }}>
              {idleTimeouts} idle timeout{idleTimeouts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
