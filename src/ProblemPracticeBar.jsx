import React, { useEffect, useState } from 'react';
import { Check, Clock, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
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
  const checkedCount = checks.filter(Boolean).length;

  return (
    <div className="practice-console">
      <div className="practice-console-top">
        <div className="practice-timer-capsule">
          <span className={`practice-timer-dot ${running ? 'is-running' : ''}`} aria-hidden="true" />
          <Clock size={14} className="practice-timer-icon" aria-hidden="true" />
          <span className="timer-readout" aria-live="off">{mins}:{secs}</span>
          <div className="practice-timer-btns">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRunning((r) => !r)}
              aria-label={running ? t.practice.pauseTimer : t.practice.startTimer}
              title={running ? t.practice.pauseTimer : t.practice.startTimer}
            >
              {running ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => { setRunning(false); setRemaining(totalSeconds); }}
              aria-label={t.practice.resetTimer}
              title={t.practice.resetTimer}
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="practice-console-right">
          <span className="practice-check-meter" aria-label="Interview checklist progress">
            {checkedCount}/{t.practice.verbalSteps.length}
          </span>
          {problem.optimal_approach && (
            <button
              type="button"
              className={`hint-step-btn ${hintStep > 0 ? 'is-active' : ''}`}
              onClick={() => setHintStep((step) => (step >= 2 ? 0 : step + 1))}
            >
              <Lightbulb size={14} aria-hidden="true" />
              <span>
                {hintStep === 0
                  ? t.practice.revealHint1
                  : hintStep === 1
                    ? t.practice.revealHint2
                    : t.practice.hideHints}
              </span>
            </button>
          )}
        </div>
      </div>

      {hintStep >= 1 && (
        <div className="hint-drawer">
          <div className="hint-chip-row">
            <span className="hint-label">{t.practice.targetComplexity}</span>
            <code>{problem.time_complexity}</code>
            <code>{problem.space_complexity}</code>
          </div>
          {hintStep >= 2 && (
            <div className="hint-chip-row">
              <span className="hint-label">{t.problems.approach}</span>
              <strong>{problem.optimal_approach}</strong>
            </div>
          )}
        </div>
      )}

      <div className="verbal-checklist-grid" role="group" aria-label={t.practice.verbalTitle}>
        {t.practice.verbalSteps.map((label, idx) => {
          const isChecked = checks[idx];
          return (
            <button
              key={label}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              className={`verbal-step-card ${isChecked ? 'is-checked' : ''}`}
              onClick={() => setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
            >
              <span className="verbal-step-badge" aria-hidden="true">
                {isChecked ? <Check size={12} /> : String(idx + 1).padStart(2, '0')}
              </span>
              <span className="verbal-step-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
