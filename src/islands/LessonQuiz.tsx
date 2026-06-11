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
  return (
    <section class="quiz" aria-label={strings.title}>
      <h2 class="quiz-title">{strings.title}</h2>
      {questions.map((q, i) => (
        <QuestionBlock key={i} q={q} index={i} strings={strings} articleId={articleId} />
      ))}
    </section>
  );
}

function QuestionBlock({
  q,
  index,
  strings,
  articleId,
}: {
  q: QuizQuestion;
  index: number;
  strings: Strings;
  articleId: string;
}) {
  const isMulti = q.type === 'multi_choice';
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const option = q.options.find((o) => o.id === id);
    // Analytics: report each option selection (no PII). No-op until initialised.
    trackQuizAttempt({
      articleId,
      questionId: `q${index + 1}`,
      optionId: id,
      correct: option?.correct === true,
    });
    setPicked((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  }

  const hint = isMulti ? strings.selectAllThatApply : strings.selectAnswer;
  const anyPicked = picked.size > 0;

  return (
    <div class="quiz-q">
      <p class="quiz-question">
        <span class="quiz-q-num">Q{index + 1}.</span> {q.question}
      </p>
      <p class="quiz-hint">{hint}</p>
      <ul class="quiz-opts">
        {q.options.map((opt) => {
          const isPicked = picked.has(opt.id);
          const reveal = isPicked;
          const stateClass = reveal ? (opt.correct ? 'correct' : 'wrong') : '';
          return (
            <li key={opt.id}>
              <button
                type="button"
                class={`quiz-opt ${isPicked ? 'picked' : ''} ${stateClass}`}
                onClick={() => toggle(opt.id)}
                aria-pressed={isPicked}
              >
                <span class="quiz-opt-marker">{reveal ? (opt.correct ? '✓' : '×') : ''}</span>
                <span class="quiz-opt-text">{opt.text}</span>
              </button>
              {reveal && opt.feedback && (
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
    </div>
  );
}
