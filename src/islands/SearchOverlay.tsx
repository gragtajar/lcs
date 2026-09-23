import { useEffect, useRef, useState } from 'preact/hooks';
import {
  loadPagefind,
  plural,
  toRow,
  sortStubsLast,
  searchUrl,
  type PagefindAPI,
  type ResultRow,
} from '../lib/search';

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
}

/** Rows the overlay fetches; the /search/ page shows the rest. */
const MAX_ROWS = 20;

export default function SearchOverlay({ strings }: { strings: Strings }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<PagefindAPI | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced search on query change.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const api = apiRef.current ?? (await loadPagefind());
      apiRef.current = api;
      if (!api) {
        setLoading(false);
        return;
      }
      const r = await api.search(query.trim());
      const top = await Promise.all(r.results.slice(0, MAX_ROWS).map((res) => res.data()));
      setResults(sortStubsLast(top.map(toRow)));
      setTotal(r.results.length);
      setActiveIdx(0);
      setLoading(false);
    }, 150);
  }, [query, open]);

  function onListKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const r = results[activeIdx];
      if (r) window.location.href = r.url;
    }
  }

  if (!open) return null;

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
          <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path
              d="M16 16l4.5 4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
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
          />
          <button class="search-close" onClick={() => setOpen(false)} aria-label={strings.close}>
            Esc
          </button>
        </div>

        <div class="search-results" role="listbox">
          {!query && <p class="search-empty">{strings.prompt}</p>}
          {query && !loading && results.length === 0 && (
            <p class="search-empty">{strings.noResults.replace('{query}', query)}</p>
          )}
          {results.map((r, i) => (
            <a
              key={r.url}
              href={r.url}
              class={`search-result ${i === activeIdx ? 'active' : ''} ${r.comingSoon ? 'soon' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
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
            <svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
