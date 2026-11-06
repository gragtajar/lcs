import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { inspectHtml, buildPolicy } from '../../scripts/csp.mjs';

const hash = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('Content-Security-Policy (scripts/csp.mjs)', () => {
  it('hashes inline scripts and styles, and skips data blocks and external scripts', () => {
    const html =
      '<script>let a = 1;</script><script type="module">import "./x.js";</script>' +
      '<script type="application/ld+json">{"@type":"Article"}</script>' +
      '<script src="/_astro/a.js"></script><style>.a{color:red}</style>';
    const { scripts, styles, problems } = inspectHtml(html);
    expect([...scripts]).toEqual([hash('let a = 1;'), hash('import "./x.js";')]);
    expect([...styles]).toEqual([hash('.a{color:red}')]);
    expect(problems).toEqual([]);
  });

  it('flags what the policy would block: handlers, style attributes, javascript: links', () => {
    const { problems } = inspectHtml(
      '<button onclick="go()">x</button><p style="color:red">y</p><a href="javascript:void(0)">z</a>',
    );
    expect(problems).toHaveLength(3);
  });

  it('allows only the site, its images and the hashed inline code', () => {
    const policy = buildPolicy(new Set(["'sha256-s'"]), new Set(["'sha256-t'"]));
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' 'report-sample' 'sha256-s'");
    expect(policy).toContain("style-src 'self' 'report-sample' 'sha256-t'");
    expect(policy).toContain("img-src 'self' data: https://ik.imagekit.io");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-inline');
  });
});
