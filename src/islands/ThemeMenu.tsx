import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Check, Moon, Sun, SunMoon } from 'lucide-preact';

/**
 * The top bar's theme menu: Light, Dark or System, the current one ticked.
 *
 * System is the default and is not stored: the page follows the device or
 * browser setting, live, so an automatic switch at sunset repaints an open page.
 * Light and Dark are stored in `lcs-theme` (localStorage) until the reader picks
 * System again. The pre-paint script in BaseLayout applies the same rules before
 * first paint and writes `data-theme-mode`, which picks the button's icon in CSS
 * (TopBar.astro), so a returning reader never sees the icon change on hydration.
 *
 * Menu-button pattern (WAI-ARIA APG): Enter, Space or the arrow keys open the
 * menu on the ticked item; Up/Down/Home/End move; Escape closes and returns to
 * the button; Tab closes and moves on; a click anywhere else closes. The
 * button's own tooltip (hover and keyboard focus) names the current mode.
 */

type Mode = 'light' | 'dark' | 'system';
type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lcs-theme';
const MODES: Mode[] = ['light', 'dark', 'system'];
const MENU_ID = 'theme-menu';
const ICONS = { light: Sun, dark: Moon, system: SunMoon };

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function storedMode(): Mode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Paint the page for `mode` and return the theme it resolves to. The phone's
 * browser bar follows too: in System mode the two theme-color metas answer the
 * device by their media queries (their built values, kept in data-auto by the
 * pre-paint script); a fixed choice points both at that theme's colour.
 */
function applyMode(mode: Mode): Theme {
  const theme: Theme = mode === 'system' ? (systemQuery().matches ? 'dark' : 'light') : mode;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-mode', mode);

  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  for (const m of metas) m.dataset.auto ??= m.content;
  const match = metas.find(
    (m) => (m.getAttribute('media') ?? '').includes('dark') === (theme === 'dark'),
  );
  for (const m of metas) {
    m.content = mode === 'system' || !match ? m.dataset.auto! : match.dataset.auto!;
  }
  return theme;
}

interface Props {
  strings: {
    /** "Theme: {mode}": the button's name and its tooltip. */
    label: string;
    /** The menu's name ("Theme"). */
    menu: string;
    light: string;
    dark: string;
    system: string;
  };
}

export default function ThemeMenu({ strings }: Props) {
  const [mode, setMode] = useState<Mode>('system');
  const [open, setOpenState] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const modeRef = useRef<Mode>('system');
  // Mirrors `open` synchronously, for the document listener below.
  const openRef = useRef(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnOpen = useRef(-1);

  const names: Record<Mode, string> = {
    light: strings.light,
    dark: strings.dark,
    system: strings.system,
  };
  const label = strings.label.replace('{mode}', names[mode]);

  const setCurrent = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
  };

  const setOpen = (value: boolean) => {
    openRef.current = value;
    setOpenState(value);
  };

  // Start from what the pre-paint script applied.
  useEffect(() => {
    setCurrent(storedMode());
  }, []);

  // System mode follows the device live; a choice made in another tab applies here too.
  useEffect(() => {
    const mq = systemQuery();
    const onSystemChange = () => {
      if (modeRef.current === 'system') applyMode('system');
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      const m = storedMode();
      setCurrent(m);
      applyMode(m);
    };
    mq.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Escape hides the tooltip wherever focus is (WCAG 1.4.13); hovering or
  // focusing the button again brings it back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTipDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus lands on an item as the menu opens (before paint, so it never flashes
  // on the button first).
  useLayoutEffect(() => {
    if (open && focusOnOpen.current >= 0) {
      itemRefs.current[focusOnOpen.current]?.focus();
      focusOnOpen.current = -1;
    }
  }, [open]);

  // A click or tap anywhere else closes the menu. Attached once, so it is in
  // place the moment the menu opens (not an effect after the next paint).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (openRef.current && !wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const openMenu = (focusIndex: number) => {
    focusOnOpen.current = focusIndex;
    setTipDismissed(true);
    setOpen(true);
  };

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (m: Mode) => {
    try {
      if (m === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // Storage may be unavailable (private mode): the choice lasts for this page.
    }
    setCurrent(m);
    applyMode(m);
    closeMenu(true);
  };

  const current = MODES.indexOf(mode);

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? current : MODES.length - 1);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const n = MODES.length;
    const at = itemRefs.current.findIndex((el) => el === document.activeElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = (at + 1) % n;
        break;
      case 'ArrowUp':
        next = (at - 1 + n) % n;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu(true);
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        return;
    }
    e.preventDefault();
    itemRefs.current[next]?.focus();
  };

  return (
    <span
      ref={wrapRef}
      class="theme-menu-wrap"
      data-open={open ? '' : undefined}
      data-tip-dismissed={tipDismissed ? '' : undefined}
      onPointerEnter={() => setTipDismissed(false)}
      onFocusIn={(e) => {
        if (e.target === buttonRef.current) setTipDismissed(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        class="theme-toggle"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={MENU_ID}
        onClick={() => (open ? closeMenu(false) : openMenu(current))}
        onKeyDown={onButtonKeyDown}
      >
        {/* All three icons are rendered; CSS shows the one for <html data-theme-mode>. */}
        {MODES.map((m) => {
          const Icon = ICONS[m];
          return <Icon key={m} class={`icon theme-icon theme-icon-${m}`} aria-hidden="true" />;
        })}
      </button>
      <span class="theme-tip" aria-hidden="true">
        <span class="theme-tip-text">{label}</span>
      </span>
      <div
        id={MENU_ID}
        class="theme-menu"
        role="menu"
        aria-label={strings.menu}
        tabIndex={-1}
        hidden={!open}
        onKeyDown={onMenuKeyDown}
      >
        {MODES.map((m, i) => {
          const Icon = ICONS[m];
          const checked = m === mode;
          return (
            <button
              key={m}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={checked ? 'true' : 'false'}
              tabIndex={-1}
              class="theme-menu-item"
              onClick={() => choose(m)}
            >
              <Icon class="icon" aria-hidden="true" />
              <span class="theme-menu-label">{names[m]}</span>
              <Check class="icon theme-menu-check" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </span>
  );
}
