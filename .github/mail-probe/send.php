<?php
// Temporary probe for the feedback form, never merged. It lives on the host
// for a minute in a randomly named folder that the probe workflow creates and
// deletes. Every request needs the random token the workflow generated.
//
//   ?action=ini   what this PHP accepts (does the folder's .user.ini apply?)
//   ?action=send  sends the two test emails, once (a lock file stops repeats)
//
// It answers yes/no values only: never the recipient, never server paths.

ini_set('display_errors', '0');
ini_set('log_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header_remove('X-Powered-By');

$cfg = require __DIR__ . '/cfg.php';
$token = $_GET['token'] ?? '';
if (!is_string($token) || !hash_equals($cfg['token'], $token)) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$action = $_GET['action'] ?? '';

if ($action === 'ini') {
    echo json_encode([
        'php' => PHP_VERSION,
        'sapi' => PHP_SAPI,
        'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        'file_uploads' => ini_get('file_uploads'),
        'post_max_size' => ini_get('post_max_size'),
        'files_received' => count($_FILES),
        'mail_function' => function_exists('mail'),
        'mbstring' => function_exists('mb_strlen'),
    ]);
    exit;
}

if ($action === 'send') {
    $lock = __DIR__ . '/sent.lock';
    if (file_exists($lock)) {
        echo json_encode(['error' => 'already sent']);
        exit;
    }
    touch($lock);

    $when = gmdate('Y-m-d H:i') . ' UTC';
    $headers = "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64";

    $body1 = "This is test 1 of 2 for the Learn Civic Sense feedback form.\n\n"
        . "The hosting server sent it with its own default sender address.\n\n"
        . "Encoding check (should read as Hindi and a tick): नमस्ते ✓\n"
        . "Sent: $when\n\n"
        . "Please tell Claude whether this arrived in your inbox or in spam.\n";
    $body2 = "This is test 2 of 2 for the Learn Civic Sense feedback form.\n\n"
        . "The hosting server sent it with the site's own address\n"
        . "(feedback@learncivicsense.in) as the sender.\n\n"
        . "Encoding check (should read as Hindi and a tick): नमस्ते ✓\n"
        . "Sent: $when\n\n"
        . "Please tell Claude whether this arrived in your inbox, in spam, or not at all.\n";

    $sent1 = mail(
        $cfg['to'],
        'Learn Civic Sense: feedback delivery test 1 of 2',
        chunk_split(base64_encode($body1)),
        $headers
    );
    $sent2 = mail(
        $cfg['to'],
        'Learn Civic Sense: feedback delivery test 2 of 2',
        chunk_split(base64_encode($body2)),
        "From: Learn Civic Sense <feedback@learncivicsense.in>\r\n" . $headers
    );
    echo json_encode(['test1_accepted' => $sent1, 'test2_accepted' => $sent2]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'unknown action']);
