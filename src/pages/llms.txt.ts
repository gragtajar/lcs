// /llms.txt (llmstxt.org): the library in brief for AI agents and assistants,
// with every readable lesson as a Markdown link and its one-line summary.
//
// Built from the lessons, like the sitemaps, so it never lists a lesson that is
// not there or misses a new one. Search engines don't use it (Google says so);
// it is for agents that are asked about the site and fetch it directly.

import type { APIRoute } from 'astro';
import { getNavCategories, loadLessonForArticle, articleUrl, categoryUrl } from '../lib/content';
import { snippetDescription } from '../lib/seo';
import { SITE_ORIGIN } from '../lib/sitemap';

const abs = (path: string) => new URL(path, SITE_ORIGIN).toString();
/** Link text can't hold an unescaped closing bracket; one line per entry. */
const linkText = (s: string) => s.replace(/[[\]]/g, '\\$&').replace(/\s+/g, ' ').trim();
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export const GET: APIRoute = () => {
  const sections: string[] = [];
  let total = 0;
  for (const cat of getNavCategories()) {
    const lines: string[] = [];
    for (const article of cat.articles) {
      if (!article.published) continue;
      const lesson = loadLessonForArticle(article);
      if (!lesson) continue;
      const summary = lesson.meta_description || lesson.tldr[0] || '';
      lines.push(
        `- [${linkText(article.title)}](${abs(articleUrl(article))})` +
          (summary ? `: ${oneLine(summary)}` : ''),
      );
    }
    if (lines.length === 0) continue;
    total += lines.length;
    sections.push(
      [
        `## ${cat.title}`,
        '',
        `${snippetDescription(cat.description)} All of them: ${abs(categoryUrl(cat.id))}`,
        '',
        ...lines,
      ].join('\n'),
    );
  }

  const body = [
    '# Learn Civic Sense',
    '',
    `> A free reading library for civic sense, at ${SITE_ORIGIN}/. India-rooted, world-applicable: ${total} short lessons on practical behaviour in shared spaces, from traffic and queues to hygiene, travel abroad and life online. Lessons list the sources they rely on, and are licensed CC BY-SA 4.0.`,
    '',
    'Each lesson page opens with a TL;DR, then the lesson in a few short sections and a quick self-check quiz; nearly all end with the sources they rely on. Lessons still being written show "Coming soon" and are not listed here.',
    '',
    `Search every lesson: ${SITE_ORIGIN}/search/?q=your+words`,
    '',
    'How to cite a lesson: "<Title>, Learn Civic Sense, learncivicsense.in (accessed YYYY-MM-DD)." To cite a primary source a lesson relies on, use that source, as listed at the end of the lesson.',
    '',
    'English is the canonical version. Hindi, Tamil, Bengali, Marathi, Telugu, Punjabi and Gujarati editions are planned.',
    '',
    sections.join('\n\n'),
    '',
    '## Optional',
    '',
    `- [About](${abs('/about/')}): what the library is, who it is for, and how lessons are written`,
    `- [Terms](${abs('/terms/')}): the CC BY-SA 4.0 licence for lessons, and the limits of what they promise`,
    `- [All lessons, by topic](${abs('/topics/')})`,
    `- [Sitemap](${abs('/sitemap-index.xml')})`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
