import React, { useEffect, useState } from 'react';
import { Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import { getMessages } from './i18n.mjs';

export function ProblemPracticeBar({ problem, locale, defaultTimerMinutes = 35 }) {
  const t = getMessages(locale);
  const totalSeconds = Math.max(60, Number(defaultTimerMinutes) * 60);
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [hintStep, setHintStep] = useState(0); // 0 = hidden, 1 = complexity target, 2 = optimal approach
  const [checks, setChecks] = useState(() => [false, false, false, false]);

  useEffect(() => {
    setRemaining(totalSeconds);
    setRunning(false);
    setHintStep(0);
    setChecks([false, false, false, false]);
  }, [problem.slug, totalSeconds]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');

  return (
    <div className="practice-forge-bar">
      <div className="practice-row">
        <div className="timer-block">
          <span className="timer-readout" aria-live="off">{mins}:{secs}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? t.practice.pauseTimer : t.practice.startTimer}
            title={running ? t.practice.pauseTimer : t.practice.startTimer}
          >
            {running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => { setRunning(false); setRemaining(totalSeconds); }}
            aria-label={t.practice.resetTimer}
            title={t.practice.resetTimer}
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>

        {problem.optimal_approach && (
          <div className="socratic-hints">
            <button
              type="button"
              className="hint-step-btn"
              onClick={() => setHintStep((step) => (step >= 2 ? 0 : step + 1))}
            >
              <Lightbulb size={15} aria-hidden="true" />
              {hintStep === 0
                ? t.practice.revealHint1
                : hintStep === 1
                  ? t.practice.revealHint2
                  : t.practice.hideHints}
            </button>
          </div>
        )}
      </div>

      {hintStep >= 1 && (
        <div className="hint-drawer">
          <p>
            <strong>{t.practice.targetComplexity}:</strong>{' '}
            <code>{problem.time_complexity}</code> · <code>{problem.space_complexity}</code>
          </p>
          {hintStep >= 2 && (
            <p><strong>{t.problems.approach}:</strong> {problem.optimal_approach}</p>
          )}
        </div>
      )}

      <div className="verbal-checklist" role="group" aria-label={t.practice.verbalTitle}>
        {t.practice.verbalSteps.map((label, idx) => (
          <label key={label} className={checks[idx] ? 'is-checked' : ''}>
            <input
              type="checkbox"
              checked={checks[idx]}
              onChange={() => setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
