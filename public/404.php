<?php
// Every URL the site has no page for is routed here by public/.htaccess:
// missing files and folders, folders without an index page, and dotfiles.
// It answers 404 with the designed not-found page that Astro builds as
// 404.html. The page cannot come from Apache itself: this host replaces the
// body of every error Apache generates with its own 13-byte text, whatever
// ErrorDocument says, but it keeps a body PHP sends (ADR 010, tested on the
// host in PR #35). Nothing from the request is read or echoed.

// Not cached: public/.htaccess sets Cache-Control: no-store for /404.php (a
// header here as well was sent twice).
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header_remove('X-Powered-By');
readfile(__DIR__ . '/404.html');
