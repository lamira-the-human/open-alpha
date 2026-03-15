import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Spinner from './Spinner';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizProps {
  subject: string;
  conceptId: string;
  conceptName: string;
  onComplete: (score: number, passed: boolean) => void;
  onCancel: () => void;
  onReviewLesson?: () => void;
}

export default function Quiz({ subject, conceptId, conceptName, onComplete, onCancel, onReviewLesson }: QuizProps) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [conceptId]);

  async function fetchQuiz() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tutor/quiz', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject, conceptId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz');
      }

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        throw new Error('No questions received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  async function submitResults(score: number) {
    try {
      await fetch('/api/tutor/quiz/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          conceptId,
          score,
          totalQuestions: questions.length,
          correctAnswers: correctCount,
        }),
      });
    } catch (error) {
      console.error('Failed to submit results:', error);
    }
  }

  function handleAnswer(answer: string) {
    if (showExplanation) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);

    if (answer === questions[currentIndex].correctAnswer) {
      setCorrectCount((prev) => prev + 1);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      // Quiz complete - correctCount already includes the last answer from handleAnswer
      const score = Math.round((correctCount / questions.length) * 100);
      setFinished(true);
      submitResults(score);
    }
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" text="Generating quiz..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={fetchQuiz} className="btn btn-primary">
              Try Again
            </button>
            <button onClick={onCancel} className="btn btn-outline">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 80;

    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: passed ? 'var(--success)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: 'white',
              fontSize: '2rem',
            }}
          >
            {passed ? '★' : score}
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h2>

          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            You scored <strong>{score}%</strong>
          </p>

          <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
            {correctCount} out of {questions.length} correct
          </p>

          {passed ? (
            <p style={{ color: 'var(--success)', marginBottom: '1.5rem' }}>
              You've mastered {conceptName}!
            </p>
          ) : (
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              You need 80% to master this concept. Keep learning and try again!
            </p>
          )}

          <button onClick={() => onComplete(score, passed)} className="btn btn-primary" style={{ width: '100%' }}>
            {passed ? 'Continue Learning' : 'Back to Learning'}
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'auto' }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {questions.map((_, i) => (
            <div key={i} style={{
              height: '8px',
              width: i === currentIndex ? '20px' : '8px',
              borderRadius: '4px',
              background: i < currentIndex ? 'var(--success)' : i === currentIndex ? 'var(--primary)' : 'var(--border)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }} />
          ))}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-light)', marginLeft: '0.375rem' }}>
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '0.875rem' }}>
          Cancel
        </button>
      </div>

      {/* Question */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.6 }}>{question.question}</h3>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {question.options.map((option, index) => {
          const letter = option.charAt(0);
          const isSelected = selectedAnswer === letter;
          const isCorrectOption = letter === question.correctAnswer;

          let background = 'var(--surface)';
          let borderColor = 'var(--border)';

          if (showExplanation) {
            if (isCorrectOption) {
              background = 'rgba(34, 197, 94, 0.1)';
              borderColor = 'var(--success)';
            } else if (isSelected && !isCorrectOption) {
              background = 'rgba(239, 68, 68, 0.1)';
              borderColor = 'var(--error)';
            }
          } else if (isSelected) {
            borderColor = 'var(--primary)';
          }

          return (
            <button
              key={index}
              onClick={() => handleAnswer(letter)}
              disabled={showExplanation}
              style={{
                textAlign: 'left',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: `2px solid ${borderColor}`,
                background,
                cursor: showExplanation ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showExplanation && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            background: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--error)'}`,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            {isCorrect ? 'Correct!' : 'Not quite right'}
          </p>
          <p>{question.explanation}</p>
          {!isCorrect && onReviewLesson && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.25)' }}>
              <button
                onClick={onReviewLesson}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--primary)', fontWeight: 500, fontSize: '0.875rem',
                  padding: 0,
                }}
              >
                ← Review the lesson
              </button>
            </div>
          )}
        </div>
      )}

      {/* Next Button */}
      {showExplanation && (
        <button onClick={handleNext} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
          {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
        </button>
      )}
    </div>
  );
}
