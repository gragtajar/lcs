// lint-staged config (moved out of package.json so it can filter paths).
// `.claude/skills/` holds vendored third-party agent skills (taste-skill,
// impeccable). They are not our code: ESLint warns on explicitly-passed
// dot-folder files, and prettier would reformat upstream files and break the
// hashes in skills-lock.json. Everything else is linted exactly as before.
const isVendored = (file) => /(^|\/)\.claude\/skills\//.test(file);
const own = (files) => files.filter((f) => !isVendored(f));
const quote = (files) => files.map((f) => `"${f}"`).join(' ');

export default {
  '*.{ts,tsx,astro,js,mjs,cjs}': (files) => {
    const f = own(files);
    return f.length
      ? [`eslint --fix --max-warnings 0 ${quote(f)}`, `prettier --write ${quote(f)}`]
      : [];
  },
  '*.{json,md,css,yml,yaml}': (files) => {
    const f = own(files);
    return f.length ? [`prettier --write ${quote(f)}`] : [];
  },
};
