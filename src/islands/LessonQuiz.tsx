import { useState } from 'preact/hooks';

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
}: {
  questions: QuizQuestion[];
  strings: Strings;
}) {
  return (
    <section class="quiz" aria-label={strings.title}>
      <h2 class="quiz-title">{strings.title}</h2>
      {questions.map((q, i) => (
        <QuestionBlock key={i} q={q} index={i} strings={strings} />
      ))}
    </section>
  );
}

function QuestionBlock({
  q,
  index,
  strings,
}: {
  q: QuizQuestion;
  index: number;
  strings: Strings;
}) {
  const isMulti = q.type === 'multi_choice';
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
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
      <ul class="quiz-opts" role="list">
        {q.options.map((opt) => {
          const isPicked = picked.has(opt.id);
          const reveal = isPicked;
          const stateClass = reveal
            ? opt.correct
              ? 'correct'
              : 'wrong'
            : '';
          return (
            <li key={opt.id}>
              <button
                type="button"
                class={`quiz-opt ${isPicked ? 'picked' : ''} ${stateClass}`}
                onClick={() => toggle(opt.id)}
                aria-pressed={isPicked}
              >
                <span class="quiz-opt-marker">
                  {reveal ? (opt.correct ? '✓' : '×') : ''}
                </span>
                <span class="quiz-opt-text">{opt.text}</span>
              </button>
              {reveal && opt.feedback && (
                <p class={`quiz-feedback ${opt.correct ? 'good' : 'meh'}`}>
                  {opt.feedback}
                </p>
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
