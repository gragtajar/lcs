import { useState } from 'preact/hooks';
import { trackQuizAttempt } from '../lib/analytics';

interface QuizOption {
  id: string;
  text: string;
  feedback?: string;
  correct?: boolean;
}
interface QuizQuestion {
  question: string;
  type?: 'single_choice' | 'multi_choice';
  options: QuizOption[];
  explanation?: string;
}
interface Strings {
  title: string;
  selectAnswer: string;
  selectAllThatApply: string;
  explanationLabel: string;
  /** "{correct} of {total} right." */
  summary: string;
  /** "All {total} right." */
  summaryAll: string;
}

/** The id the article's table of contents links to. */
export const QUIZ_SECTION_ID = 'quick-check';

const LETTERS = 'ABCDEFGH';

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export default function LessonQuiz({
  questions,
  strings,
  articleId = '',
}: {
  questions: QuizQuestion[];
  strings: Strings;
  articleId?: string;
}) {
  // One entry per question: the ids picked so far.
  const [picks, setPicks] = useState<Set<string>[]>(() => questions.map(() => new Set()));

  function pick(qIndex: number, id: string) {
    const q = questions[qIndex]!;
    const option = q.options.find((o) => o.id === id);
    // Analytics: report each option selection (no PII). No-op until initialised.
    trackQuizAttempt({
      articleId,
      questionId: `q${qIndex + 1}`,
      optionId: id,
      correct: option?.correct === true,
    });
    setPicks((prev) => {
      const next = prev.map((s) => new Set(s));
      const set = next[qIndex]!;
      if (q.type === 'multi_choice') {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      } else {
        set.clear();
        set.add(id);
      }
      return next;
    });
  }

  // The ending: once every question has an answer, say how it went. A
  // single-choice question is right when its pick is correct; a multi-choice
  // one when the picked set equals the correct set.
  const answered = picks.filter((s) => s.size > 0).length;
  const done = answered === questions.length;
  const correctCount = questions.reduce((n, q, i) => {
    const set = picks[i]!;
    const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
    const isRight =
      q.type === 'multi_choice'
        ? correctIds.length === set.size && correctIds.every((id) => set.has(id))
        : correctIds.some((id) => set.has(id));
    return n + (isRight ? 1 : 0);
  }, 0);
  const summary = done
    ? correctCount === questions.length
      ? fill(strings.summaryAll, { total: questions.length })
      : fill(strings.summary, { correct: correctCount, total: questions.length })
    : '';

  return (
    <section class="quiz" id={QUIZ_SECTION_ID} aria-labelledby="quiz-h">
      <h2 class="quiz-title" id="quiz-h">
        {strings.title}
      </h2>
      {questions.map((q, i) => (
        <QuestionBlock
          key={i}
          q={q}
          index={i}
          strings={strings}
          picked={picks[i]!}
          onPick={(id) => pick(i, id)}
        />
      ))}
      {/* Announced politely so screen-reader users hear the result too. */}
      <p class={`quiz-summary ${done ? 'is-done' : ''}`} role="status" aria-live="polite">
        {summary}
      </p>
    </section>
  );
}

function QuestionBlock({
  q,
  index,
  strings,
  picked,
  onPick,
}: {
  q: QuizQuestion;
  index: number;
  strings: Strings;
  picked: Set<string>;
  onPick: (id: string) => void;
}) {
  const isMulti = q.type === 'multi_choice';
  const hint = isMulti ? strings.selectAllThatApply : strings.selectAnswer;
  const anyPicked = picked.size > 0;
  // The most recent feedback, for the live region (visual feedback sits inline).
  const lastPicked = [...picked].pop();
  const lastFeedback = lastPicked ? q.options.find((o) => o.id === lastPicked)?.feedback : '';

  return (
    <div class="quiz-q">
      <p class="quiz-question">
        <span class="quiz-q-num">{index + 1}.</span> {q.question}
      </p>
      <p class="quiz-hint">{hint}</p>
      <ul class="quiz-opts">
        {q.options.map((opt, oi) => {
          const isPicked = picked.has(opt.id);
          const stateClass = isPicked ? (opt.correct ? 'correct' : 'wrong') : '';
          return (
            <li key={opt.id}>
              <button
                type="button"
                class={`quiz-opt ${isPicked ? 'picked' : ''} ${stateClass}`}
                onClick={() => onPick(opt.id)}
                aria-pressed={isPicked}
              >
                {/* Letter before the pick; verdict glyph after. */}
                <span class="quiz-opt-marker" aria-hidden="true">
                  {isPicked ? (opt.correct ? '✓' : '×') : (LETTERS[oi] ?? '')}
                </span>
                <span class="quiz-opt-text">{opt.text}</span>
              </button>
              {isPicked && opt.feedback && (
                <p class={`quiz-feedback ${opt.correct ? 'good' : 'meh'}`}>{opt.feedback}</p>
              )}
            </li>
          );
        })}
      </ul>
      {anyPicked && q.explanation && (
        <div class="quiz-explanation">
          <strong>{strings.explanationLabel}.</strong> {q.explanation}
        </div>
      )}
      <span class="quiz-sr" role="status" aria-live="polite">
        {lastFeedback}
      </span>
    </div>
  );
}
