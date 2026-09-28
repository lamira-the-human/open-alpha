import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Fractions.css';

interface PracticeQuestion {
  id: string;
  title: string;
  teaching: string;
  example: string;
  prompt: string;
  input: 'fraction' | 'number' | 'comparison';
  bars: { numerator: number; denominator: number }[];
}

interface Feedback {
  correct: boolean;
  explanation: string;
}

export default function Fractions() {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<'welcome' | 'teach' | 'answer' | 'complete'>('welcome');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempts, setAttempts] = useState<number[]>([0, 0, 0]);
  const [firstTry, setFirstTry] = useState<boolean[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = questions[index];

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/fractions/practice', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load practice. Please reload this page.');
        const data = await response.json();
        if (!Array.isArray(data.questions) || data.questions.length !== 3) throw new Error('Practice is unavailable. Please reload this page.');
        setQuestions(data.questions);
      })
      .catch(failure => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load practice.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    heading.current?.focus();
  }, [stage, index]);

  async function checkAnswer(event: FormEvent) {
    event.preventDefault();
    if (pending.current || feedback?.correct || !answer.trim()) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/fractions/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check that answer. Try again.');
      if (typeof data.correct !== 'boolean' || typeof data.explanation !== 'string') throw new Error('Could not check that answer. Try again.');
      setFeedback(data);
      setAttempts(previous => previous.map((count, position) => position === index ? count + 1 : count));
      if (attempts[index] === 0) setFirstTry(previous => [...previous, data.correct]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Connection problem. Your answer has not been checked; try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function nextQuestion() {
    if (!feedback?.correct) return;
    setAnswer('');
    setFeedback(null);
    setError('');
    if (index === questions.length - 1) setStage('complete');
    else {
      setIndex(previous => previous + 1);
      setStage('teach');
    }
  }

  function restart() {
    setIndex(0);
    setStage('welcome');
    setAnswer('');
    setFeedback(null);
    setAttempts([0, 0, 0]);
    setFirstTry([]);
    setError('');
  }

  return (
    <main className="fraction-page">
      <nav className="fraction-nav" aria-label="Practice navigation">
        <Link to="/">Open Alpha</Link>
        <span>FRACTION CONFIDENCE</span>
      </nav>
      <div className="fraction-shell">
        <p className="fraction-eyebrow">Small steps. Real understanding.</p>
        {stage === 'welcome' ? (
          <section className="fraction-card">
            <h1 ref={heading} tabIndex={-1}>Fractions don’t have to feel like guessing.</h1>
            <p className="fraction-lead">See what the numbers mean. Try three problems. Get a useful explanation whenever you need one.</p>
            <ol className="fraction-skills">
              <li><strong>Name the amount</strong><span>What do the top and bottom numbers tell you?</span></li>
              <li><strong>Keep the amount</strong><span>Different pieces. The same fraction.</span></li>
              <li><strong>Compare the amounts</strong><span>Which is larger—and why?</span></li>
            </ol>
            <p>Best if you already know multiplication and division through 12. No timer, account, or score to protect.</p>
            {loading && <p role="status">Loading your practice…</p>}
            {error && <p role="alert" className="fraction-error">{error}</p>}
            <button className="btn btn-primary" disabled={loading || questions.length !== 3} onClick={() => setStage('teach')}>Let’s make it click</button>
            <p className="fraction-note">Guided practice, not a test. Progress stays on this page and resets when you reload.</p>
          </section>
        ) : stage === 'complete' ? (
          <section className="fraction-card">
            <p className="fraction-eyebrow">Three skills practiced</p>
            <h1 ref={heading} tabIndex={-1}>You worked through it.</h1>
            <p className="fraction-lead">You answered {firstTry.filter(Boolean).length} of 3 questions correctly on your first try. You completed all three with feedback available.</p>
            <ul className="fraction-results">
              {questions.map((item, position) => <li key={item.id}><strong>{item.title}</strong><span>{firstTry[position] ? 'Correct on the first try' : `Completed after feedback · ${attempts[position]} attempts`}</span></li>)}
            </ul>
            <p><strong>What this tells you:</strong> you practiced naming a fraction, finding an equivalent fraction, and comparing equal-size wholes. This short session does not establish lasting mastery.</p>
            <p><strong>Tell someone why:</strong> how can two fractions have different numbers but name the same amount?</p>
            <button className="btn btn-primary" onClick={restart}>Practice these examples again</button>
            <p className="fraction-note">Repeating these same questions is practice—not a fresh assessment.</p>
          </section>
        ) : question ? (
          <>
            <ol className="fraction-progress" aria-label="Practice progress">
              {questions.map((item, position) => <li key={item.id} aria-current={position === index ? 'step' : undefined}><span>{position < index ? '✓' : position + 1}</span>{item.title}</li>)}
            </ol>
            <section className="fraction-card">
              <p className="fraction-eyebrow">{stage === 'teach' ? 'See the idea' : 'Your turn'} · Skill {index + 1} of 3</p>
              <h1 ref={heading} tabIndex={-1}>{question.title}</h1>
              {stage === 'teach' ? (
                <>
                  <p className="fraction-lead">{question.teaching}</p>
                  <div className="fraction-models">
                    {question.bars.map((bar, position) => (
                      <figure key={position}>
                        <div className="fraction-bar" role="img" aria-label={`${bar.numerator} of ${bar.denominator} equal parts selected`}>
                          {Array.from({ length: bar.denominator }, (_, part) => <span key={part} className={part < bar.numerator ? 'selected' : ''} />)}
                        </div>
                        <figcaption>{bar.numerator}/{bar.denominator}</figcaption>
                      </figure>
                    ))}
                  </div>
                  <p className="fraction-example">{question.example}</p>
                  <button className="btn btn-primary" onClick={() => { setStage('answer'); setError(''); }}>Try it with different numbers</button>
                </>
              ) : (
                <>
                  <p className="fraction-lead" id="fraction-prompt">{question.prompt}</p>
                  <form onSubmit={checkAnswer}>
                    {question.input === 'comparison' ? (
                      <fieldset disabled={busy || feedback?.correct} className="fraction-choices" aria-describedby="fraction-prompt">
                        <legend>The first amount is…</legend>
                        {[['<', 'less than'], ['=', 'equal to'], ['>', 'greater than']].map(([symbol, label]) => (
                          <label key={symbol}><input type="radio" name="comparison" value={symbol} checked={answer === symbol} onChange={() => { setAnswer(symbol); setError(''); }} required /><strong>{symbol}</strong><span>{label}</span></label>
                        ))}
                      </fieldset>
                    ) : (
                      <label className="fraction-answer">{question.input === 'fraction' ? 'Your fraction (top/bottom)' : 'Missing top number'}
                        <input className="input" value={answer} onChange={event => { setAnswer(event.target.value); setError(''); }} disabled={busy || feedback?.correct} maxLength={30} required autoComplete="off" inputMode={question.input === 'number' ? 'numeric' : 'text'} aria-describedby="fraction-prompt" />
                      </label>
                    )}
                    {!feedback?.correct && <button className="btn btn-primary" disabled={busy || !answer.trim()} type="submit">{busy ? 'Checking…' : feedback ? 'Check again' : 'Check my answer'}</button>}
                  </form>
                  {error && <p role="alert" className="fraction-error">{error}</p>}
                  {feedback && <div className={`fraction-feedback ${feedback.correct ? 'correct' : ''}`} role="status"><strong>{feedback.correct ? 'That’s right.' : 'Let’s work through it.'}</strong><p>{feedback.explanation}</p></div>}
                  {feedback?.correct ? <button className="btn btn-primary" onClick={nextQuestion}>{index === questions.length - 1 ? 'See what I practiced' : 'Next skill'}</button> : <button className="fraction-text-button" disabled={busy} onClick={() => setStage('teach')}>See the visual explanation again</button>}
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
