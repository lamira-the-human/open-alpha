import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import Spinner from '../components/Spinner';

interface ConceptNode {
  id: string;
  name: string;
  gradeLevel: number;
  prerequisites: string[];
  masteryScore: number;
  lastAttemptAt: string | null;
}

interface MapData {
  subjectId: string;
  subjectName: string;
  concepts: ConceptNode[];
}

// Layout constants
const NODE_W = 150;
const NODE_H = 52;
const COL_STEP = 200;
const ROW_STEP = 76;
const PAD = 24;
const LABEL_H = 28;

type NodeStatus = 'mastered' | 'in-progress' | 'available' | 'locked';

const STATUS_STYLES: Record<NodeStatus, { fill: string; stroke: string; text: string }> = {
  mastered:     { fill: '#dcfce7', stroke: '#22c55e', text: '#166534' },
  'in-progress':{ fill: '#ede9fe', stroke: '#4f46e5', text: '#3730a3' },
  available:    { fill: '#ffffff', stroke: '#6b7280', text: '#374151' },
  locked:       { fill: '#f3f4f6', stroke: '#e5e7eb', text: '#9ca3af' },
};

function getStatus(concept: ConceptNode, all: ConceptNode[]): NodeStatus {
  if (concept.masteryScore >= 80) return 'mastered';
  if (concept.masteryScore > 0) return 'in-progress';
  const prereqsMet = concept.prerequisites.every(pid => {
    const prereq = all.find(c => c.id === pid);
    return prereq && prereq.masteryScore >= 80;
  });
  return prereqsMet ? 'available' : 'locked';
}

function truncate(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

export default function ConceptMap() {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!subject) return;
    fetch(`/api/progress/map/${subject}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setMapData)
      .catch(() => setError('Failed to load concept map'))
      .finally(() => setLoading(false));
  }, [subject, token]);

  if (loading) return <Spinner size="large" text="Loading concept map..." />;

  if (error || !mapData) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error || 'Subject not found'}</p>
        <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { concepts, subjectName } = mapData;

  // Build level groups
  const maxLevel = Math.max(...concepts.map(c => c.gradeLevel));
  const byLevel: ConceptNode[][] = Array.from({ length: maxLevel + 1 }, (_, l) =>
    concepts.filter(c => c.gradeLevel === l)
  );
  const maxPerLevel = Math.max(...byLevel.map(arr => arr.length), 1);

  // SVG canvas
  const svgW = PAD * 2 + (maxLevel + 1) * COL_STEP;
  const svgH = PAD + LABEL_H + maxPerLevel * ROW_STEP + PAD;

  // Compute node center positions
  const pos: Record<string, { cx: number; cy: number }> = {};
  byLevel.forEach((levelConcepts, level) => {
    const colTotalH = levelConcepts.length * NODE_H + Math.max(0, levelConcepts.length - 1) * (ROW_STEP - NODE_H);
    const startY = PAD + LABEL_H + (maxPerLevel * ROW_STEP - colTotalH) / 2;
    levelConcepts.forEach((c, i) => {
      pos[c.id] = {
        cx: PAD + level * COL_STEP + NODE_W / 2,
        cy: startY + i * ROW_STEP + NODE_H / 2,
      };
    });
  });

  const tooltipConcept = tooltip ? concepts.find(c => c.id === tooltip.id) : null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <main className="container" style={{ padding: '1.5rem 1rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <Link to="/dashboard" style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>
            ← Dashboard
          </Link>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{subjectName} Map</h2>
          <button
            onClick={() => navigate(`/learn/${subject}`)}
            className="btn btn-primary"
            style={{ marginLeft: 'auto', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Continue Learning →
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(Object.entries(STATUS_STYLES) as [NodeStatus, typeof STATUS_STYLES[NodeStatus]][]).map(([status, style]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
              <div style={{
                width: 12, height: 12, borderRadius: 3,
                background: style.fill,
                border: `2px solid ${style.stroke}`,
                flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-light)' }}>
                {status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          ))}
        </div>

        {/* Map container */}
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            background: 'var(--surface)',
            position: 'relative',
          }}
          onClick={() => setTooltip(null)}
        >
          <svg width={svgW} height={svgH} style={{ display: 'block' }}>

            {/* Arrow marker */}
            <defs>
              <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <polygon points="0 0, 7 3.5, 0 7" fill="#d1d5db" />
              </marker>
            </defs>

            {/* Grade labels */}
            {byLevel.map((_, level) => (
              <text
                key={level}
                x={PAD + level * COL_STEP + NODE_W / 2}
                y={PAD + LABEL_H / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill="#9ca3af"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              >
                {level === 0 ? 'K' : `Grade ${level}`}
              </text>
            ))}

            {/* Edges */}
            {concepts.flatMap(concept =>
              concept.prerequisites.map(prereqId => {
                const from = pos[prereqId];
                const to = pos[concept.id];
                if (!from || !to) return null;
                const x1 = from.cx + NODE_W / 2;
                const y1 = from.cy;
                const x2 = to.cx - NODE_W / 2;
                const y2 = to.cy;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={`edge-${prereqId}-${concept.id}`}
                    d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })
            )}

            {/* Nodes */}
            {concepts.map(concept => {
              const p = pos[concept.id];
              if (!p) return null;
              const { cx, cy } = p;
              const x = cx - NODE_W / 2;
              const y = cy - NODE_H / 2;
              const status = getStatus(concept, concepts);
              const style = STATUS_STYLES[status];
              const clickable = status !== 'locked';
              const isActive = tooltip?.id === concept.id;

              return (
                <g
                  key={concept.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (clickable) {
                      navigate(`/learn/${subject}/${concept.id}`);
                    } else {
                      setTooltip(isActive ? null : { id: concept.id, x: cx, y });
                    }
                  }}
                  style={{ cursor: clickable ? 'pointer' : 'not-allowed' }}
                >
                  <rect
                    x={x} y={y}
                    width={NODE_W} height={NODE_H}
                    rx={8}
                    fill={style.fill}
                    stroke={isActive ? '#1f2937' : style.stroke}
                    strokeWidth={isActive ? 2.5 : 2}
                    filter={clickable && !isActive ? undefined : undefined}
                  />
                  <text
                    x={cx}
                    y={concept.masteryScore > 0 ? cy - 8 : cy + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11.5}
                    fontWeight={600}
                    fill={style.text}
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  >
                    {truncate(concept.name)}
                  </text>
                  {concept.masteryScore > 0 && (
                    <text
                      x={cx} y={cy + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill={style.stroke}
                      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    >
                      {concept.masteryScore}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Locked tooltip */}
            {tooltip && tooltipConcept && (() => {
              const p = pos[tooltip.id];
              if (!p) return null;
              const tx = Math.min(p.cx - 60, svgW - 144);
              const ty = p.cy - NODE_H / 2 - 52;
              const prereqNames = tooltipConcept.prerequisites
                .map(pid => concepts.find(c => c.id === pid)?.name ?? pid)
                .join(', ');
              return (
                <g>
                  <rect x={tx} y={Math.max(ty, 4)} width={144} height={46} rx={6} fill="#1f2937" />
                  <text x={tx + 8} y={Math.max(ty, 4) + 14} fontSize={10} fill="white"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                    Complete first:
                  </text>
                  <text x={tx + 8} y={Math.max(ty, 4) + 30} fontSize={10} fill="#9ca3af"
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                    {truncate(prereqNames, 20)}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-light)', marginTop: '0.75rem', textAlign: 'center' }}>
          Click any unlocked concept to start learning · Locked concepts show required prerequisites
        </p>
      </main>
    </div>
  );
}
