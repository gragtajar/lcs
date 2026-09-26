# Rollback runbook

How to undo a bad production deploy of `learncivicsense.in` (GoDaddy cPanel,
deployed over FTPS by **Deploy production** — see [deploy.md](./deploy.md) and
[ADR 008](../adrs/008-godaddy-cpanel-hosting.md)).

The upload is **not atomic**, and there is no "previous version" button on this
host. A rollback is a new deploy of the old code, through the same pipeline and
the same checks. Never force-push `main`.

## A bad site change (a merged pull request in `lcs`)

1. Find the merge commit that introduced it:
   ```bash
   git log --oneline -20 origin/main
   ```
2. Revert it on a branch and open a pull request:
   ```bash
   git checkout -b revert/<short-name> origin/main
   git revert -m 1 <merge-sha>
   git push origin revert/<short-name>
   gh pr create --repo gragtajar/lcs --title "revert: <what>" --body "Why"
   ```
3. Merge it once CI is green. The push to `main` deploys the reverted site and
   verifies it.

## A bad content change (a merged pull request in `lcs-content`)

Revert the merge in `lcs-content` the same way (branch, `git revert -m 1`,
pull request, merge). Content sync deploys it within ~15 minutes; to deploy at
once:

```bash
gh workflow run deploy.yml --repo gragtajar/lcs --ref main -f reason="Revert <what>"
```

## The upload itself failed half way

Re-run the failed jobs of that Deploy production run. The action's state file
on the server makes the retry upload only what is missing.

## Confirm

The Verify production job of the new run must be green, and

```bash
curl -s https://learncivicsense.in/build-info.json
```

must show the commits you expect.
