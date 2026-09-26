// /build-info.json — the deploy marker. It records which commits of the three
// repos this build was made from, so the Deploy workflow can prove the live
// site is the build it tested (it compares this file byte for byte) and the
// Content sync workflow can tell when lcs-content or lcs-workflow has moved on.
// Served with Cache-Control: no-store (public/.htaccess).

import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNavCategories } from '../lib/content';
import { CONTENT_REPO_PATH, WORKFLOW_REPO_PATH } from '../config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** HEAD of the git repository at `dir`, or null when there is none. */
function headOf(dir: string): string | null {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export const GET: APIRoute = () => {
  const articles = getNavCategories().flatMap((c) => c.subtopics.flatMap((s) => s.articles));
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  const info = {
    site: headOf(ROOT),
    content: headOf(path.resolve(ROOT, CONTENT_REPO_PATH)),
    workflow: headOf(path.resolve(ROOT, WORKFLOW_REPO_PATH)),
    built_at: new Date().toISOString(),
    run:
      GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
        ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
        : null,
    lessons: {
      planned: articles.length,
      published: articles.filter((a) => a.published).length,
    },
  };
  return new Response(`${JSON.stringify(info, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
