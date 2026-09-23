// Markdown rendering for lesson bodies.
// - Adds stable anchor IDs on h2/h3 (TOC scroll-spy targets).
// - Wraps tables in a horizontal-scroll container for narrow viewports.
// - Collects a TOC list as a side-effect of rendering.

import { marked, type Tokens, Renderer } from 'marked';

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocItem[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text of an inline token list (for attributes, not for display). */
function cellText(tokens: Tokens.Generic[]): string {
  return tokens
    .map((t) => {
      if ('tokens' in t && Array.isArray(t.tokens)) return cellText(t.tokens as Tokens.Generic[]);
      const text = (t as unknown as { text?: unknown }).text;
      return text == null ? '' : String(text);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function renderLessonBody(md: string): RenderedMarkdown {
  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const renderer = new Renderer();

  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const text = tokens
      .map((t) => ('text' in t ? String((t as { text: unknown }).text) : ''))
      .join('');
    const base = slugify(text || `section-${toc.length + 1}`) || `section-${toc.length + 1}`;
    let candidate = base;
    let n = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${n++}`;
    usedIds.add(candidate);

    if (depth === 2 || depth === 3) {
      toc.push({ id: candidate, text, level: depth });
    }

    // Plain headings: the id is enough for the TOC and for section links. Wrapping
    // the text in an anchor made every heading announce as "link" to screen
    // readers and turn teal on hover, promising an action that only scrolled.
    const inner = this.parser.parseInline(tokens);
    return `<h${depth} id="${candidate}">${inner}</h${depth}>\n`;
  };

  renderer.table = function ({ header, rows }: Tokens.Table) {
    // Each cell carries its column header as data-label so the stylesheet can
    // stack rows into label/value pairs on narrow screens instead of clipping
    // the last column behind a horizontal scroll nobody discovers.
    const labels = header.map((cell) => escapeAttr(cellText(cell.tokens)));
    const headRow = header
      .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
      .join('');
    const bodyRows = rows
      .map(
        (row) =>
          '<tr>' +
          row
            .map(
              (cell, i) =>
                `<td data-label="${labels[i] ?? ''}">${this.parser.parseInline(cell.tokens)}</td>`,
            )
            .join('') +
          '</tr>',
      )
      .join('');
    return `<div class="table-wrap"><table><thead><tr>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table></div>\n`;
  };

  const html = marked.parse(md, {
    renderer,
    gfm: true,
    breaks: false,
    async: false,
  }) as string;

  return { html, toc };
}

// Helper kept exported in case templates want to render inline snippets (e.g. a TL;DR bullet
// that contains light markdown).
export function renderInline(md: string): string {
  return marked.parseInline(md, { async: false }) as string;
}

/**
 * Flatten a markdown string to plain prose: strips code fences, heading markers,
 * blockquote/list markers, table pipes, image/link syntax, and emphasis marks,
 * then collapses whitespace. Used for SEO text fields (JSON-LD `articleBody` and
 * HowTo step text) where crawlers want readable text, not markup. Heading and
 * link *text* survive; only the markers are removed.
 */
export function stripMarkdownToText(md: string): string {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading markers
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered-list markers
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // table rows
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/[*_`~]/g, '') // emphasis / code marks
    .replace(/\s+/g, ' ')
    .trim();
}

export { escapeHtml };
