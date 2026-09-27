import { useEffect, useState } from 'preact/hooks';
import { Moon, Sun } from 'lucide-preact';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'lcs-theme';

function getInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    // localStorage may be unavailable (private mode, file:// preview). Ignore.
  }
}

interface Props {
  /** "Switch to dark theme" / "Switch to light theme": the button's name and its tooltip. */
  labels: { toDark: string; toLight: string };
}

/**
 * The top bar's theme switch: an icon button that says what it will do, in the
 * site's own tooltip rather than the browser's `title` bubble. The tooltip shows
 * on hover (pointer devices) and on keyboard focus, stays while the pointer
 * moves onto it, and Escape hides it (WCAG 1.4.13). It repeats the button's
 * accessible name, so it is hidden from assistive tech.
 */
export default function ThemeToggle({ labels }: Props) {
  const [theme, setTheme] = useState<Theme>('light');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setTheme(getInitial());
  }, []);

  // Escape dismisses the tooltip wherever focus is; hovering or focusing the
  // toggle again brings it back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? labels.toDark : labels.toLight;

  return (
    <span
      class="theme-toggle-wrap"
      data-tip-dismissed={dismissed ? '' : undefined}
      onPointerEnter={() => setDismissed(false)}
      onFocusIn={() => setDismissed(false)}
    >
      <button
        type="button"
        class="theme-toggle"
        aria-label={label}
        onClick={() => {
          applyTheme(next);
          setTheme(next);
        }}
      >
        {theme === 'dark' ? (
          <Sun class="icon" aria-hidden="true" />
        ) : (
          <Moon class="icon" aria-hidden="true" />
        )}
      </button>
      <span class="theme-tip" aria-hidden="true">
        <span class="theme-tip-text">{label}</span>
      </span>
    </span>
  );
}
