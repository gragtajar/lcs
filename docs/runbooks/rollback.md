# Rollback runbook

How to revert a bad production deploy. Two paths depending on the host.

## Current host: cPanel via FTP

The FTP push is **not atomic**. A bad deploy may leave the site partially
uploaded. To roll back:

### Option A: re-deploy a known-good commit

1. Find the last green commit on `main`:
   ```bash
   git log --oneline origin/main
   ```
2. Revert local main to that commit and push:
   ```bash
   git checkout main
   git reset --hard <known-good-sha>
   git push --force-with-lease origin main
   ```
3. The `Deploy Website to cPanel` workflow will re-run and push the old
   build via FTP. Wait ~3-5 min for the upload to finish.
4. Verify: `curl -fsSL https://learncivicsense.in/` and the
   `/traffic/honking-discipline/the-case-against-honking/` article.

Note: `--force-with-lease` is destructive. If anyone has merged on top of
your bad commit, prefer **Option B** (revert commit) so you don't lose work.

### Option B: revert PR commit

1. Identify the merge commit that introduced the regression:
   ```bash
   git log --oneline -20 origin/main
   ```
2. Revert it:
   ```bash
   git checkout main
   git pull
   git revert -m 1 <merge-sha>
   git push origin main
   ```
3. The revert commit triggers a fresh deploy.

## Future host: Cloudflare Pages (post-migration)

Atomic deploys mean rollback is one click.

### Via dashboard

1. **Cloudflare dashboard → Pages → learncivicsense → Deployments**
2. Find the last good deployment in the list.
3. Click **... → Rollback to this deployment**.
4. Within ~30 seconds the CDN cache flips. Verify with `curl`.

### Via CLI

```bash
npx wrangler pages deployment list --project-name learncivicsense
npx wrangler pages deployment promote <deployment-id> --project-name learncivicsense
```

### Verify

```bash
curl -sI https://learncivicsense.in/ | grep -E '^(HTTP|cf-cache)'
curl -fsSL https://learncivicsense.in/ > /dev/null && echo OK
curl -fsSL https://learncivicsense.in/sitemap-index.xml > /dev/null && echo OK
```

## After the rollback

1. **Open an incident issue** in the repo. Label: `incident`.
2. **Write a postmortem** in `docs/runbooks/postmortems/YYYY-MM-DD-slug.md`.
3. **Block forward progress** until the underlying bug is fixed and a
   regression test exists.

## What NOT to do

- **Don't roll back by manually re-uploading via FTP.** It races with any
  in-flight CI run.
- **Don't disable CI to push a hotfix.** Either the gate is right and the
  hotfix needs tests, or the gate is wrong and that's a separate fix.
- **Don't force-push to `main` without `--force-with-lease`.** It will
  silently overwrite a collaborator's push.
