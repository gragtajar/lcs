// The addresses from before the site had two levels (ADR 011, 2026-09-28): a
// lesson lived at /{topic}/{subtopic}/{lesson}/ and each subtopic had a page at
// /{topic}/{subtopic}/. public/.htaccess redirects every one of them, from a
// frozen block between `# BEGIN legacy addresses` and `# END legacy addresses`:
//
//   RewriteRule ^topic/(sub|sub)/?$ /topic/ [R=301,L]              (subtopic pages)
//   RewriteRule ^topic/sub/(slug|slug)/?$ /topic/$1/ [R=301,L]     (lessons)
//
// parseLegacyAddresses() expands that block into [old, new] path pairs. Used by
// scripts/verify-deploy.mjs (every pair is requested on the live site after
// each deploy) and tests/unit/legacy-addresses.test.ts (every target still
// exists and no old address shadows a page).

const RULE =
  /^\s*RewriteRule \^([a-z0-9-]+)\/(?:\(([a-z0-9|-]+)\)|([a-z0-9-]+)\/\(([a-z0-9|-]+)\))\/\?\$ (\/\S+) \[R=301,L\]$/;

/**
 * @param {string} htaccess the whole .htaccess text
 * @returns {{ pairs: Array<[string, string]>, rules: number, unparsed: string[] }}
 *   pairs: [old path, new path]; rules: RewriteRule lines in the block;
 *   unparsed: RewriteRule lines in the block that do not have either shape.
 */
export function parseLegacyAddresses(htaccess) {
  const block =
    htaccess.split('# BEGIN legacy addresses')[1]?.split('# END legacy addresses')[0] ?? '';
  const pairs = [];
  const unparsed = [];
  let rules = 0;
  for (const line of block.split('\n')) {
    if (!/^\s*RewriteRule /.test(line)) continue;
    rules++;
    const m = line.match(RULE);
    if (!m) {
      unparsed.push(line.trim());
      continue;
    }
    const [, topic, subtopics, subtopic, slugs, target] = m;
    if (subtopics) {
      if (target !== `/${topic}/`) unparsed.push(line.trim());
      for (const s of subtopics.split('|')) pairs.push([`/${topic}/${s}/`, `/${topic}/`]);
    } else {
      if (target !== `/${topic}/$1/`) unparsed.push(line.trim());
      for (const s of slugs.split('|'))
        pairs.push([`/${topic}/${subtopic}/${s}/`, `/${topic}/${s}/`]);
    }
  }
  return { pairs, rules, unparsed };
}
