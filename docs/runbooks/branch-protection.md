# Branch protection on `main`

GitHub settings can't be set in code, so this is the runbook for configuring
them once after merging the CI workflows.

## One-time setup

GitHub repo → **Settings → Branches → Branch protection rules → Add rule**:

- **Branch name pattern:** `main`
- **Require a pull request before merging**
  - Require approvals: 1
  - Dismiss stale approvals when new commits are pushed
  - Require review from Code Owners
- **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - Required checks (add as each lands):
    - `Lint, typecheck, build`
    - `Content lint` (optional — currently a soft-fail when content repo missing)
    - `E2E smoke tests` (PR 4)
    - `Lighthouse CI` (PR 3)
- **Require conversation resolution before merging**
- **Require linear history**
- **Include administrators** — yes, hold yourself to the same standard
- **Restrict force pushes** — yes
- **Restrict deletions** — yes

## Why each setting matters

| Setting                     | Why                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Require PR                  | Forces every change through code review (even your own)                                                              |
| Approvals = 1               | At launch this is you reviewing your own PRs (LGTM workflow); raise to ≥1 external reviewer when contributors arrive |
| Dismiss stale approvals     | Approve was for the previous code; new commits should be re-reviewed                                                 |
| Require Code Owners         | CODEOWNERS in `.github/` routes notifications                                                                        |
| Require status checks pass  | Lint/build/test failures cannot be bypassed without admin override                                                   |
| Require branches up-to-date | Stops the "merged green, but stale base" foot-gun                                                                    |
| Require linear history      | Keeps `git log --oneline` readable; force-rebase before merge                                                        |
| Include administrators      | The discipline is the point — opt-out defeats it                                                                     |
| Restrict force pushes       | Prevents rewriting public history                                                                                    |

## Verifying the rule is on

```bash
gh api repos/gragtajar/lcs/branches/main/protection | jq '.required_status_checks, .required_pull_request_reviews'
```

Should return the configured checks and review requirements.

## When CI is red and you must merge

You shouldn't. If you genuinely must (e.g. CI is broken not the code):

1. Use the admin override checkbox on the PR page (logged in the audit log).
2. Open a `chore` issue immediately to restore the green gate.
3. Don't make it a habit — every override is a small erosion of trust in the gate.
