import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ChevronRight, LoaderCircle, Search } from 'lucide-preact';
import {
  loadPagefind,
  plural,
  toRow,
  sortStubsLast,
  searchUrl,
  type PagefindAPI,
  type ResultRow,
} from '../lib/search';
import { useDelayedFlag } from './useDelayedFlag';

interface Strings {
  open: string;
  close: string;
  title: string;
  placeholder: string;
  prompt: string;
  noResults: string; // contains {query}
  comingSoonChip: string;
  /** "See all {count} results" — the handoff to the shareable /search/ page. */
  seeAllOne: string;
  seeAllOther: string;
  /** "Searching…": the loading state, shown and announced when a search is slow. */
  searching: string;
  /** "{count} result(s)": announced to screen readers when results arrive. */
  resultsOne: string;
  resultsOther: string;
}

/** Rows the overlay fetches; the /search/ page shows the rest. */
const MAX_ROWS = 20;
const DEBOUNCE_MS = 150;
/** A search slower than this shows the loading state; a faster one shows nothing. */
const BUSY_AFTER_MS = 150;
const LISTBOX_ID = 'search-overlay-results';
const optionId = (i: number) => `search-overlay-option-${i}`;

export default function SearchOverlay({ strings }: { strings: Strings }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  // `pending`: the query changed and its results are not in yet (debounce
  // included), so "no results" must not show. `searching`: the index is loading
  // or answering. Only a slow search (`busy`) gets the visible loading state.
  const [pending, setPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<PagefindAPI | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  // What moved the highlight last: arrow keys scroll it into view, the pointer
  // never does (the row under it is already in view).
  const movedByRef = useRef<'key' | 'pointer'>('pointer');
  const pointerRef = useRef({ x: -1, y: -1 });
  const busy = useDelayedFlag(searching, BUSY_AFTER_MS);

  // Open via global event from the TopBar button.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('lcs:open-search', onOpen);
    return () => window.removeEventListener('lcs:open-search', onOpen);
  }, []);

  // Keyboard shortcut: '/' opens the overlay; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !open) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the input on open + preload the index.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    loadPagefind().then((api) => {
      apiRef.current = api;
    });
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Debounced search on query change. Each search takes a sequence number, and
  // only the newest one may write results: a slow early search must not
  // overwrite a later one, or end its loading state.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      seqRef.current++;
      setResults([]);
      setTotal(0);
      setPending(false);
      setSearching(false);
      return;
    }
    setPending(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++seqRef.current;
      setSearching(true);
      const api = apiRef.current ?? (await loadPagefind());
      apiRef.current = api;
      if (id !== seqRef.current) return;
      if (!api) {
        setPending(false);
        setSearching(false);
        return;
      }
      const r = await api.search(q);
      const top = await Promise.all(r.results.slice(0, MAX_ROWS).map((res) => res.data()));
      if (id !== seqRef.current) return; // a newer query has taken over
      setResults(sortStubsLast(top.map(toRow)));
      setTotal(r.results.length);
      setActiveIdx(0);
      setPending(false);
      setSearching(false);
    }, DEBOUNCE_MS);
  }, [query, open]);

  // New results start at the top of the list.
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [results]);

  // Arrow keys move the highlight; keep the highlighted row inside the list's
  // scroll area, before paint. Every keyboard move scrolls for its own row, so
  // a held key (fast repeats) still ends with the last row in view.
  useLayoutEffect(() => {
    if (movedByRef.current !== 'key') return;
    listRef.current
      ?.querySelector<HTMLElement>(`#${optionId(activeIdx)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // The pointer takes the highlight only when it really moves: a list scrolled
  // by the arrow keys slides rows under a resting pointer, and that must not
  // pull the highlight back.
  function onRowPointer(e: MouseEvent, i: number) {
    const { clientX: x, clientY: y } = e;
    if (x === pointerRef.current.x && y === pointerRef.current.y) return;
    pointerRef.current = { x, y };
    movedByRef.current = 'pointer';
    setActiveIdx(i);
  }

  function onListKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      movedByRef.current = 'key';
      setActiveIdx((i) =>
        e.key === 'ArrowDown' ? Math.min(i + 1, results.length - 1) : Math.max(i - 1, 0),
      );
    } else if (e.key === 'Enter') {
      const r = results[activeIdx];
      if (r) window.location.href = r.url;
    }
  }

  if (!open) return null;

  const q = query.trim();
  let announcement = '';
  if (busy) announcement = strings.searching;
  else if (q && !pending) {
    announcement =
      results.length > 0
        ? plural(total, strings.resultsOne, strings.resultsOther)
        : strings.noResults.replace('{query}', q);
  }

  return (
    <div class="search-overlay" role="dialog" aria-modal="true" aria-label={strings.title}>
      <button
        type="button"
        class="search-backdrop"
        aria-label={strings.close}
        onClick={() => setOpen(false)}
      />
      <div class="search-panel">
        <div class="search-input-row">
          {busy ? (
            <LoaderCircle class="icon search-loading" aria-hidden="true" />
          ) : (
            <Search class="icon" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="search"
            class="search-input"
            placeholder={strings.placeholder}
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={onListKey}
            autoComplete="off"
            spellcheck={false}
            aria-label={strings.placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={LISTBOX_ID}
            aria-activedescendant={results.length > 0 ? optionId(activeIdx) : undefined}
          />
          <button class="search-close" onClick={() => setOpen(false)} aria-label={strings.close}>
            Esc
          </button>
        </div>

        <div
          ref={listRef}
          class="search-results"
          id={LISTBOX_ID}
          role="listbox"
          aria-label={strings.title}
          aria-busy={busy}
        >
          {!q && <p class="search-empty">{strings.prompt}</p>}
          {q && results.length === 0 && busy && <p class="search-empty">{strings.searching}</p>}
          {q && !pending && results.length === 0 && (
            <p class="search-empty">{strings.noResults.replace('{query}', q)}</p>
          )}
          {results.map((r, i) => (
            <a
              key={r.url}
              id={optionId(i)}
              href={r.url}
              class={`search-result ${i === activeIdx ? 'active' : ''} ${r.comingSoon ? 'soon' : ''}`}
              onMouseMove={(e) => onRowPointer(e, i)}
              role="option"
              aria-selected={i === activeIdx}
            >
              <span class="search-result-title-row">
                <span class="search-result-title">{r.title}</span>
                {r.comingSoon && <span class="search-result-chip">{strings.comingSoonChip}</span>}
              </span>
              {r.where && <span class="search-result-breadcrumb">{r.where}</span>}
            </a>
          ))}
        </div>

        {results.length > 0 && (
          <a class="search-see-all" href={searchUrl(query)}>
            {plural(total, strings.seeAllOne, strings.seeAllOther)}
            <ChevronRight class="icon" aria-hidden="true" />
          </a>
        )}

        <p class="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}
