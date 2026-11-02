# Lighthouse CI

`@lhci/cli` has its own package here, apart from the site's `package.json`.

Every release of it pulls in Lighthouse and Puppeteer, whose dependency chain
carries advisories that no upgrade clears: `@lhci/cli` pins Lighthouse exactly,
and `extract-zip` has no fixed release. Installed with the site, they failed the
weekly `npm audit` gate. None of them applies to how it runs here. Each needs
hostile input (a crafted zip archive, FTP server, temp-file name or browser
message), and the CI job that runs it holds none of the site's secrets and only
loads the static build into the runner's own Chrome on localhost.

Kept apart, the gate stays strict for everything that builds and ships the site,
and for the test tools that run beside the CI secrets.

The version is pinned exactly; the lockfile pins the rest. Run it locally with:

```bash
npm ci --prefix tools/lhci
npm run build
npm run lhci            # desktop: lighthouserc.json
npm run lhci:mobile     # mobile: lighthouserc.mobile.json
```
