<?php

declare(strict_types=1);

// The feedback form's endpoint: /feedback/ posts here (ADR 012).
//
// A visitor picks what the feedback is about and writes up to 500 characters.
// This checks the request and emails it to the person who runs the site. The
// only thing kept on the server is, per sender, a keyed hash of the IP address
// with the times they sent feedback (rate limiting); entries older than a day
// are dropped whenever the form is next used.
//
// The recipient's address is not in the site's code. The deploy writes it from
// the FEEDBACK_EMAIL_TO secret into .lcs-private/feedback-config.php, which is
// never served: every path with a dotted segment answers 404 (public/.htaccess).
//
// Before this runs, public/.htaccess refuses bodies over 16 KB (413) and
// multipart bodies, i.e. file uploads (403), so PHP never parses an upload.
// Every check is repeated here.
//
// Replies: JSON for the page's script (Accept: application/json); otherwise a
// 303 to /feedback/sent/ or /feedback/not-sent/, so the form works without
// script. scripts/test-feedback-endpoint.mjs covers each branch (CI).

ini_set('display_errors', '0');
ini_set('log_errors', '0'); // no error_log file in the web root
header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');

const SITE_ORIGIN = 'https://learncivicsense.in';
const PRIVATE_DIR = __DIR__ . '/.lcs-private';
const MIN_CHARS = 3;
const MAX_CHARS = 500;
const MAX_LINKS = 3;
const PER_SENDER_HOUR = 5;
const PER_SENDER_DAY = 20;
const ALL_PER_DAY = 200;

/** The form's choices, value => label (the label goes into the email). */
const TYPES = [
    'new-article' => 'New articles',
    'correction' => 'Correction in article',
    'report' => 'Report something',
    'other' => 'Others',
];

$wantsJson = str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');

/**
 * Ends the request. The page's script gets JSON; a plain form post gets a
 * redirect to a result page (post/redirect/get).
 *
 * @param array<string, string> $headers
 */
function finish(bool $json, int $status, string $code, array $headers = []): never
{
    foreach ($headers as $name => $value) {
        header("$name: $value");
    }
    $sent = $code === 'sent';
    if ($json) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $sent, 'code' => $code]);
    } else {
        http_response_code(303);
        header('Location: ' . SITE_ORIGIN . ($sent ? '/feedback/sent/' : '/feedback/not-sent/'));
    }
    exit;
}

/**
 * The message as it will be counted and sent: line breaks as single LF (a
 * browser sends CRLF), no control characters apart from line breaks and tabs,
 * none of the direction overrides that make text read differently from what
 * it says, at most one empty line in a row, no space around it.
 */
function normalise(string $text): string
{
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace(
        '/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}-\x{009F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u',
        '',
        $text,
    ) ?? '';
    $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? '';
    return trim($text);
}

/**
 * Whether the message carries an obvious attempt to get code run: SQL
 * injection, markup or script, server-side templates, path traversal. Nothing
 * here reaches a database, a page or a shell (the message is only emailed, as
 * plain text), so this is a filter for junk, not the protection itself. Each
 * pattern is narrow enough that ordinary sentences pass; the endpoint test
 * checks a few that come close.
 */
function looksLikeCode(string $text): bool
{
    $patterns = [
        '/\bunion\s+(?:all\s+)?select\b/i',
        // Tautologies: ' OR 'a'='a, " or 1=1, and 2=2.
        '/[\'"`]\s*(?:or|and)\s+[\'"`]?(\w+)[\'"`]?\s*=\s*[\'"`]?\1(?!\w)/i',
        '/\b(?:or|and)\s+(\d+)\s*=\s*\1\b/i',
        '/;\s*(?:drop|delete|insert|update|alter|truncate|create|exec)\s+(?:table|from|into|database|\w+\s+set)\b/i',
        '/\b(?:drop|truncate|alter)\s+(?:table|database)\b/i',
        '/\binsert\s+into\s+\w+\s*(?:\(|values\b)/i',
        '/\b(?:information_schema|xp_cmdshell|pg_sleep|load_file|into\s+(?:out|dump)file)\b/i',
        '/\b(?:sleep|benchmark)\(\s*\d/i',
        '/\bwaitfor\s+delay\b/i',
        '/[\'"`]\s*;?\s*--\s*$/m',
        '/<\s*\/?\s*(?:script|iframe|object|embed|svg|img|link|meta|style|form|input|body|html)\b/i',
        '/\bjavascript:(?!\s)/i',
        '/\bon(?:error|load|click|focus|blur|submit|change|input|toggle|mouse\w+|key\w+|pointer\w+|animation\w+)\s*=/i',
        '/<\?(?:php|=)/i',
        '/\$\{\s*jndi\s*:/i',
        '/\{\{[^}]*\}\}|\{%[^%]*%\}/',
        '/(?:\.\.[\/\\\\]){2,}/',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }
    return false;
}

/** The server's own random key for hashing addresses, made on first use. */
function hashKey(): string
{
    $file = PRIVATE_DIR . '/feedback-key';
    if (!is_file($file)) {
        file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($file, 0600);
    }
    return trim((string) file_get_contents($file));
}

/**
 * Counts one send for this sender if the limits allow it. Returns null when
 * allowed, else [code, seconds until a send would be allowed].
 *
 * @return array{0: string, 1: int}|null
 */
function admit(string $ip, int $now): ?array
{
    $fh = fopen(PRIVATE_DIR . '/feedback-rate.json', 'c+');
    if ($fh === false || !flock($fh, LOCK_EX)) {
        return ['unavailable', 60];
    }
    $data = json_decode((string) stream_get_contents($fh), true);
    $data = is_array($data) ? $data : [];
    $recent = static fn(mixed $times, int $since): array => array_values(
        array_filter(is_array($times) ? $times : [], static fn($t) => is_int($t) && $t > $since),
    );

    $dayAgo = $now - 86400;
    $senders = [];
    foreach ((array) ($data['senders'] ?? []) as $key => $times) {
        $kept = $recent($times, $dayAgo);
        if ($kept !== []) {
            $senders[$key] = $kept;
        }
    }
    $all = $recent($data['all'] ?? [], $dayAgo);
    $me = hash_hmac('sha256', $ip, hashKey());
    $mine = $senders[$me] ?? [];
    $lastHour = $recent($mine, $now - 3600);

    $refusal = null;
    if (count($lastHour) >= PER_SENDER_HOUR) {
        $refusal = ['rate', min($lastHour) + 3600 - $now];
    } elseif (count($mine) >= PER_SENDER_DAY) {
        $refusal = ['rate', min($mine) + 86400 - $now];
    } elseif (count($all) >= ALL_PER_DAY) {
        $refusal = ['busy', min($all) + 86400 - $now];
    } else {
        $mine[] = $now;
        $senders[$me] = $mine;
        $all[] = $now;
    }

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) json_encode(['senders' => $senders, 'all' => $all]));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $refusal === null ? null : [$refusal[0], max(1, $refusal[1])];
}

/**
 * Sends the email. The default is PHP's mail(), through the host's mail server.
 * The endpoint test sets 'transport' => 'file' in its own config, to write the
 * message to a folder instead; the deployed config never has that key.
 *
 * @param array<string, mixed> $config
 */
function deliver(array $config, string $subject, string $body): bool
{
    $headers = "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64";
    if (($config['transport'] ?? 'mail') === 'file') {
        $name = rtrim((string) ($config['outbox'] ?? ''), '/') . '/' . uniqid('message-', true) . '.json';
        $record = ['to' => $config['to'], 'subject' => $subject, 'headers' => $headers, 'body' => $body];
        return file_put_contents($name, (string) json_encode($record)) !== false;
    }
    return mail((string) $config['to'], $subject, chunk_split(base64_encode($body)), $headers);
}

// ---- The request ----

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'POST') {
    if (!$wantsJson) {
        // Someone opened this address in a browser: show them the form.
        http_response_code(303);
        header('Location: ' . SITE_ORIGIN . '/feedback/');
        exit;
    }
    finish(true, 405, 'method', ['Allow' => 'POST']);
}

// Only this site's own pages post here (every current browser sends Origin
// with a POST).
if (($_SERVER['HTTP_ORIGIN'] ?? '') !== SITE_ORIGIN) {
    finish($wantsJson, 403, 'origin');
}

// A plain form post, and never a file.
$mediaType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
if ($mediaType !== 'application/x-www-form-urlencoded' || $_FILES !== []) {
    finish($wantsJson, 415, 'media');
}

// The field people never see (the page hides it); a bot that fills it is told
// its message was sent, and nothing is sent.
if (($_POST['website'] ?? '') !== '') {
    finish($wantsJson, 200, 'sent');
}

$type = $_POST['type'] ?? null;
if (!is_string($type) || !array_key_exists($type, TYPES)) {
    finish($wantsJson, 400, 'type');
}

$raw = $_POST['message'] ?? null;
if (!is_string($raw) || !mb_check_encoding($raw, 'UTF-8')) {
    finish($wantsJson, 400, 'length');
}
$message = normalise($raw);
$length = mb_strlen($message, 'UTF-8');
if ($length < MIN_CHARS || $length > MAX_CHARS) {
    finish($wantsJson, 422, 'length');
}
if (looksLikeCode($message)) {
    finish($wantsJson, 422, 'code');
}
if (preg_match_all('~(?:https?://|www\.)\S+~i', $message) > MAX_LINKS) {
    finish($wantsJson, 422, 'links');
}

$configFile = PRIVATE_DIR . '/feedback-config.php';
$config = is_file($configFile) ? include $configFile : null;
$to = is_array($config) ? ($config['to'] ?? null) : null;
if (!is_string($to) || filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
    finish($wantsJson, 503, 'unavailable');
}

$refusal = admit((string) ($_SERVER['REMOTE_ADDR'] ?? ''), time());
if ($refusal !== null) {
    [$code, $wait] = $refusal;
    finish($wantsJson, $code === 'unavailable' ? 503 : 429, $code, ['Retry-After' => (string) $wait]);
}

$label = TYPES[$type];
$when = (new DateTimeImmutable('now', new DateTimeZone('Asia/Kolkata')))->format('j M Y, H:i');
$body = "Type: $label\n"
    . "Sent: $when IST\n\n"
    . "$message\n\n"
    . "-- \n"
    . "Sent from the feedback form on learncivicsense.in.\n"
    . "The form asks for no name or email address, so there is no one to reply to.\n";

if (!deliver($config, "[Learn Civic Sense feedback] $label", $body)) {
    finish($wantsJson, 502, 'unavailable');
}
finish($wantsJson, 200, 'sent');
