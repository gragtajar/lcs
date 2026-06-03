/**
 * Conventional Commits, with two tightening rules so the log reads cleanly:
 * sentence-case subject (no SCREAMING or "fix:Stuff"), and a 100-char body line cap.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'always', 'sentence-case'],
    'body-max-line-length': [2, 'always', 100],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'ci',
        'build',
        'revert',
        'content',
      ],
    ],
  },
};
