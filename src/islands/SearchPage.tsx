import { useEffect, useRef, useState } from 'preact/hooks';
import {
  loadPagefind,
  plural,
  toRow,
  sortStubsLast,
  queryFromSearch,
  searchUrl,
  type PagefindAPI,
  type ResultRow,
} from '../lib/search';

// The /search/ page's own search: the same Pagefind index and the same result row
// as the top-bar overlay, laid out as a page — a field that keeps the URL shareable
// (`?q=`), a count, hairline rows with the match marked, and "Show more". The
// server-rendered topic index below it (`browseId`) is the empty state and the way
// out of a no-results search; this island only hides it while results are showing.

interface Strings {
  placeholder: string;
  clear: string;
  prompt: string;
  /** "{count} lesson matches “{query}”" / "{count} lessons match “{query}”" */
  countOne: string;
  countOther: string;
  /** "{count} coming soon" */
  comingSoonOne: string;
  comingSoonOther: string;
  /** "No lessons found for “{query}”." */
  noResults: string;
  noResultsHint: string;
  /** "Show {count} more" */
  showMoreOne: string;
  showMoreOther: string;
  /** "{n} min read" */
  minRead: string;
  comingSoonChip: string;
  tryLabel: string;
  examples: string[];
  unavailable: string;
}

interface Props {
  strings: Strings;
  /** id of the server-rendered browse block to hide while results are showing. */
  browseId: string;
}

/** Rows shown before "Show more". */
const FIRST_PAGE = 10;
/** Result records fetched per search; the count line is exact up to this many. */
const MAX_RESULTS = 60;
const DEBOUNCE_MS = 150;

type Status = 'idle' | 'loading' | 'done' | 'unavailable';

export default function SearchPage({ strings, browseId }: Props) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [shown, setShown] = useState(FIRST_PAGE);
  const [status, setStatus] = useState<Status>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<PagefindAPI | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const seededRef = useRef(false);

  // Mount: a shared `?q=` is the query; with nothing to show, the field takes focus.
  useEffect(() => {
    const q = queryFromSearch(window.location.search);
    seededRef.current = true;
    if (q) setQuery(q);
    else inputRef.current?.focus();
  }, []);

  // `/` focuses this page's own field. Capture phase, so the overlay's window
  // listener (which would open a second search over this one) never sees it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Debounced search. The URL follows the query so any results page can be shared.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (seededRef.current) window.history.replaceState(null, '', searchUrl(q));
    if (!q) {
      seqRef.current++;
      setRows([]);
      setTotal(0);
      setShown(FIRST_PAGE);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    debounceRef.current = setTimeout(async () => {
      const id = ++seqRef.current;
      const api = apiRef.current ?? (await loadPagefind());
      apiRef.current = api;
      if (id !== seqRef.current) return;
      if (!api) {
        setStatus('unavailable');
        return;
      }
      const r = await api.search(q);
      const data = await Promise.all(r.results.slice(0, MAX_RESULTS).map((res) => res.data()));
      if (id !== seqRef.current) return; // a newer query has taken over
      setRows(sortStubsLast(data.map(toRow)));
      setTotal(r.results.length);
      setShown(FIRST_PAGE);
      setStatus('done');
    }, DEBOUNCE_MS);
  }, [query]);

  // The browse block is the empty state and the no-results fallback; it steps
  // aside only while there are results to read.
  useEffect(() => {
    const el = document.getElementById(browseId);
    if (el) el.hidden = rows.length > 0;
  }, [rows.length, browseId]);

  const q = query.trim();
  const visible = rows.slice(0, shown);
  const stubs = rows.filter((r) => r.comingSoon).length;

  let statusText = '';
  if (status === 'unavailable') statusText = strings.unavailable;
  else if (status === 'done' && rows.length > 0) {
    statusText = plural(total, strings.countOne, strings.countOther).replace('{query}', q);
    if (stubs > 0) {
      statusText += ` · ${plural(stubs, strings.comingSoonOne, strings.comingSoonOther)}`;
    }
  } else if (status === 'done') {
    statusText = strings.noResults.replace('{query}', q);
  }

  return (
    <div class="sp">
      <form class="sp-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <label class="sp-field">
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
            class="sp-input"
            placeholder={strings.placeholder}
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            autoComplete="off"
            spellcheck={false}
            enterkeyhint="search"
            aria-label={strings.placeholder}
            aria-describedby="sp-hint"
          />
          {q && (
            <button
              type="button"
              class="sp-clear"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              {strings.clear}
            </button>
          )}
        </label>
        <p class="sp-hint" id="sp-hint">
          {strings.prompt}
        </p>
      </form>

      {!q && strings.examples.length > 0 && (
        <p class="sp-try">
          <span class="sp-try-label">{strings.tryLabel}</span>
          {strings.examples.map((ex) => (
            <a
              key={ex}
              class="sp-example"
              href={searchUrl(ex)}
              onClick={(e) => {
                e.preventDefault();
                setQuery(ex);
              }}
            >
              {ex}
            </a>
          ))}
        </p>
      )}

      <div class="sp-status" role="status" aria-live="polite">
        {statusText}
        {status === 'done' && rows.length === 0 && (
          <span class="sp-status-hint"> {strings.noResultsHint}</span>
        )}
      </div>

      {visible.length > 0 && (
        <ul class="sp-list">
          {visible.map((r) => (
            <li key={r.url} data-cluster={r.clusterId}>
              <a class={`search-result ${r.comingSoon ? 'soon' : ''}`} href={r.url}>
                <span class="search-result-title-row">
                  <span class="search-result-title">{r.title}</span>
                  {r.comingSoon && <span class="search-result-chip">{strings.comingSoonChip}</span>}
                </span>
                {r.excerpt && (
                  // Pagefind builds the excerpt from our own indexed text and only ever
                  // adds <mark> around the matched words.
                  <span
                    class="search-result-excerpt"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                  />
                )}
                <span class="search-result-breadcrumb">
                  {r.format && <span class="search-result-format">{r.format}</span>}
                  {r.format && r.minutes ? ' · ' : ''}
                  {r.minutes ? strings.minRead.replace('{n}', String(r.minutes)) : ''}
                  {(r.format || r.minutes) && r.where ? ' · ' : ''}
                  {r.where}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {rows.length > shown && (
        <button type="button" class="sp-more" onClick={() => setShown(rows.length)}>
          {plural(rows.length - shown, strings.showMoreOne, strings.showMoreOther)}
        </button>
      )}
    </div>
  );
}
