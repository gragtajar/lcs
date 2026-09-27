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

export default function ThemeToggle({ label }: { label: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(getInitial());
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      class="theme-toggle"
      aria-label={label}
      title={label}
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
  );
}
