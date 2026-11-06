// GoDaddy inserts its TCCL performance-monitoring loader into every HTML
// response, immediately before </html>: an inline <script> that queues
// `_trfd` settings and a <script src> from img1.wsimg.com (found by the first
// deploy, 2026-09-26; the snippet says opting out means contacting GoDaddy
// support). It is recognised this narrowly; any other difference between a
// served page and the build is a real difference.
export const HOST_INJECTION =
  /<script>'undefined'=== typeof _trfq \|\| \(window\._trfq = \[\]\);[^<]*<\/script><script src='https:\/\/img1\.wsimg\.com\/traffic-assets\/js\/tccl\.min\.js'><\/script>(?=<\/html>)/;
