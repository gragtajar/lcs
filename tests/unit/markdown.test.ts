import { describe, it, expect } from 'vitest';
import { renderLessonBody, renderInline, escapeHtml } from '../../src/lib/markdown';

describe('renderLessonBody()', () => {
  it('renders an empty body', () => {
    const { html, toc } = renderLessonBody('');
    expect(html).toBe('');
    expect(toc).toEqual([]);
  });

  it('adds stable anchor ids to h2 and h3 headings', () => {
    const { html, toc } = renderLessonBody(
      ['## The moment', 'body', '### A sub-section', 'more body'].join('\n\n'),
    );
    expect(html).toContain('<h2 id="the-moment">');
    expect(html).toContain('<h3 id="a-sub-section">');
    expect(toc).toEqual([
      { id: 'the-moment', text: 'The moment', level: 2 },
      { id: 'a-sub-section', text: 'A sub-section', level: 3 },
    ]);
  });

  it('deduplicates anchor ids when headings collide', () => {
    const md = ['## Why', 'a', '## Why', 'b'].join('\n\n');
    const { html, toc } = renderLessonBody(md);
    expect(toc.map((t) => t.id)).toEqual(['why', 'why-2']);
    expect(html).toContain('id="why-2"');
  });

  it('strips diacritics and punctuation in slugs', () => {
    const { toc } = renderLessonBody("## What's actually happening — really?");
    expect(toc[0]?.id).toBe('whats-actually-happening-really');
  });

  it('wraps tables in a horizontal-scroll container', () => {
    const md = ['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n');
    const { html } = renderLessonBody(md);
    expect(html).toContain('<div class="table-wrap">');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('h1 does not appear in the toc (only h2/h3)', () => {
    const md = '# Title\n\n## H2\n\ntext';
    const { toc } = renderLessonBody(md);
    expect(toc).toHaveLength(1);
    expect(toc[0]?.level).toBe(2);
  });
});

describe('renderInline()', () => {
  it('renders inline markdown without block wrapping', () => {
    expect(renderInline('*emph* and `code`')).toContain('<em>emph</em>');
    expect(renderInline('*emph* and `code`')).toContain('<code>code</code>');
  });
});

describe('escapeHtml()', () => {
  it('escapes the four dangerous characters', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('renderLessonBody() slug fallbacks', () => {
  it('falls back to section-N when a heading has no slug-able characters', () => {
    const { html, toc } = renderLessonBody('## !!!');
    expect(toc[0]?.id).toMatch(/^section-\d+$/);
    expect(html).toContain('id="section-');
  });
});
