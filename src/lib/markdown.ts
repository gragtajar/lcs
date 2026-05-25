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

export function renderLessonBody(md: string): RenderedMarkdown {
  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  const renderer = new Renderer();

  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const text = tokens
      .map((t) => ('text' in t ? String((t as { text: unknown }).text) : ''))
      .join('');
    let base = slugify(text || `section-${toc.length + 1}`) || `section-${toc.length + 1}`;
    let candidate = base;
    let n = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${n++}`;
    usedIds.add(candidate);

    if (depth === 2 || depth === 3) {
      toc.push({ id: candidate, text, level: depth });
    }

    const inner = this.parser.parseInline(tokens);
    return `<h${depth} id="${candidate}"><a class="anchor-link" href="#${candidate}">${inner}</a></h${depth}>\n`;
  };

  renderer.table = function ({ header, rows }: Tokens.Table) {
    const headRow = header
      .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
      .join('');
    const bodyRows = rows
      .map(
        (row) =>
          '<tr>' +
          row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('') +
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

export { escapeHtml };
