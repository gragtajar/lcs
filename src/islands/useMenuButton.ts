import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

/**
 * The behaviour the top bar's small menus share (ThemeMenu, LanguageMenu): the
 * WAI-ARIA APG menu-button pattern. Enter or Space opens the menu on the ticked
 * item, as does the Down arrow (Up opens it on the last); Up/Down/Home/End move;
 * Escape closes and returns to the button; Tab closes and moves on; a click
 * anywhere else closes. Disabled items stay focusable, as the pattern asks.
 */

interface Options {
  /** How many items the menu has. */
  count: number;
  /** The ticked item: where the menu opens. */
  current: number;
  /** Runs as the menu opens (the theme button hides its tooltip). */
  onOpen?: () => void;
}

export function useMenuButton({ count, current, onOpen }: Options) {
  const [open, setOpenState] = useState(false);
  // Mirrors `open` synchronously, for the document listener below.
  const openRef = useRef(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnOpen = useRef(-1);

  const setOpen = (value: boolean) => {
    openRef.current = value;
    setOpenState(value);
  };

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
    onOpen?.();
    setOpen(true);
  };

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onButtonClick = () => (open ? closeMenu(false) : openMenu(current));

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? current : count - 1);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const at = itemRefs.current.findIndex((el) => el === document.activeElement);
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = (at + 1) % count;
        break;
      case 'ArrowUp':
        next = (at - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
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

  /** The ref for item `i`, so the arrow keys can reach it. */
  const itemRef = (i: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[i] = el;
  };

  return {
    open,
    wrapRef,
    buttonRef,
    itemRef,
    closeMenu,
    onButtonClick,
    onButtonKeyDown,
    onMenuKeyDown,
  };
}
