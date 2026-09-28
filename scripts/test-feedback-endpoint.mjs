#!/usr/bin/env node
// Exercises every branch of public/feedback.php (ADR 012) under PHP's built-in
// server, in a throwaway folder whose config sends nothing: 'transport' =>
// 'file' writes each message to an outbox folder instead of mail(). Run by CI
// (the "Feedback endpoint (PHP)" job); needs `php` (8.1 or newer) on PATH.
//
// What only the host can show (Apache refusing multipart and bodies over
// 16 KB, the private folder never served) is checked on the live site after
// every deploy by scripts/verify-deploy.mjs, which never sends an email.
//
//   node scripts/test-feedback-endpoint.mjs

import { spawn } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ORIGIN = 'https://learncivicsense.in';
const TO = 'feedback-test@example.invalid';
const PORT = 8000 + Math.floor(Math.random() * 1000);
const root = mkdtempSync(path.join(tmpdir(), 'lcs-feedback-'));
const privateDir = path.join(root, '.lcs-private');
const outbox = path.join(root, 'outbox');
const rateFile = path.join(privateDir, 'feedback-rate.json');
const configFile = path.join(privateDir, 'feedback-config.php');
const labels = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')).feedback.types;

mkdirSync(privateDir);
mkdirSync(outbox);
copyFileSync('public/feedback.php', path.join(root, 'feedback.php'));
writeFileSync(
  configFile,
  `<?php return ['to' => '${TO}', 'transport' => 'file', 'outbox' => ${JSON.stringify(outbox)}];\n`,
);

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

/** One request to the endpoint; resolves with { status, headers, body, json }. */
function send({ method = 'POST', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORT, path: '/feedback.php', method, headers },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            // not JSON
          }
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const form = (fields) => new URLSearchParams(fields).toString();
/** A POST as the page's script makes it. */
const post = (fields, extra = {}) =>
  send({
    headers: {
      Origin: ORIGIN,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...extra,
    },
    body: form(fields),
  });
const outboxFiles = () => readdirSync(outbox).sort();
const lastMessage = () => {
  const files = outboxFiles();
  return files.length ? JSON.parse(readFileSync(path.join(outbox, files.at(-1)), 'utf8')) : null;
};
const resetRate = () => rmSync(rateFile, { force: true });
const expectCode = async (name, fields, status, code) => {
  const r = await post(fields);
  check(name, r.status === status && r.json?.code === code, `${r.status} ${r.body.slice(0, 120)}`);
};

const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root], { stdio: 'ignore' });
try {
  // Wait for the server.
  for (let i = 0; ; i++) {
    try {
      await send({ method: 'GET', headers: { Accept: 'application/json' } });
      break;
    } catch (err) {
      if (i > 50) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log('Requests the endpoint turns away');
  let r = await send({ method: 'GET', headers: { Accept: 'application/json' } });
  check('GET answers 405 with Allow: POST', r.status === 405 && r.headers.allow === 'POST');
  r = await send({ method: 'GET' });
  check(
    'GET from a browser goes to the form',
    r.status === 303 && r.headers.location === `${ORIGIN}/feedback/`,
  );
  r = await send({
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ type: 'other', message: 'no origin here' }),
  });
  check('a POST without Origin is refused (403)', r.status === 403 && r.json?.code === 'origin');
  r = await post({ type: 'other', message: 'from elsewhere' }, { Origin: 'https://example.com' });
  check('a POST from another site is refused (403)', r.status === 403 && r.json?.code === 'origin');
  const boundary = 'lcsboundary';
  r = await send({
    headers: {
      Origin: ORIGIN,
      Accept: 'application/json',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body:
      `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nother\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\nwith a file\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nfile\r\n` +
      `--${boundary}--\r\n`,
  });
  check('a multipart post (a file) is refused (415)', r.status === 415 && r.json?.code === 'media');
  r = await send({
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Content-Type': 'text/plain' },
    body: 'type=other&message=plain',
  });
  check('a text/plain post is refused (415)', r.status === 415 && r.json?.code === 'media');

  console.log('The hidden field');
  r = await post({ type: 'other', message: 'I am a bot', website: 'http://spam.example' });
  check(
    'a filled trap answers "sent" and sends nothing',
    r.status === 200 && r.json?.ok === true && outboxFiles().length === 0,
  );

  console.log('What a message may be');
  await expectCode(
    'an unknown type is refused',
    { type: 'praise', message: 'hello there' },
    400,
    'type',
  );
  await expectCode('a missing type is refused', { message: 'hello there' }, 400, 'type');
  await expectCode('two characters are too few', { type: 'other', message: 'hi' }, 422, 'length');
  await expectCode(
    'spaces only are too few',
    { type: 'other', message: '   \n\n  ' },
    422,
    'length',
  );
  await expectCode(
    '501 characters are too many',
    { type: 'other', message: 'a'.repeat(501) },
    422,
    'length',
  );
  await expectCode(
    '501 Devanagari characters are too many',
    { type: 'other', message: 'क'.repeat(501) },
    422,
    'length',
  );
  const probes = {
    "tautology ' OR '1'='1": "hello' OR '1'='1",
    'numeric tautology or 1=1': 'id 5 or 1=1',
    'UNION SELECT': 'x UNION ALL SELECT password FROM users',
    'stacked DROP TABLE': 'fine; DROP TABLE lessons',
    'comment after a quote': "admin' --",
    'SLEEP()': 'x and sleep(5)',
    'a script tag': '<script>alert(1)</script>',
    'an event handler': '<b onmouseover=alert(1)>hi</b>',
    'a javascript: URL': 'go to javascript:alert(1)',
    'a PHP tag': '<?php system("id"); ?>',
    'a template': 'my name is {{7*7}}',
    JNDI: '${jndi:ldap://x.example/a}',
    'path traversal': 'see ../../etc/passwd',
  };
  for (const [name, message] of Object.entries(probes)) {
    await expectCode(`code is refused: ${name}`, { type: 'other', message }, 422, 'code');
  }
  const fourLinks = 'https://a.example https://b.example www.c.example http://d.example';
  await expectCode('four links are too many', { type: 'report', message: fourLinks }, 422, 'links');
  check(
    'nothing was sent for any refused message',
    outboxFiles().length === 0,
    `${outboxFiles().length} files`,
  );

  console.log('Messages that are fine (none of these may be taken for code)');
  const fine = [
    'Please select a seat from the list where it says aisle; update the date too.',
    'The fine is < 500 rupees, and people need sleep (8 hours) at night.',
    'JavaScript: the quiz button did nothing on my phone.',
    'Either left or right = wrong, the article says keep left.',
    "The correct one = 'keep left' in the second paragraph, and 1 or 2 = 3 is a typo.",
    'सिग्नल पर हॉर्न बजाना गलत है — please add a lesson on this.',
    'Three links are fine: https://a.example www.b.example http://c.example',
  ];
  for (const [i, message] of fine.entries()) {
    if (i % 5 === 0) resetRate();
    r = await post({ type: 'other', message });
    const got = lastMessage();
    check(
      `accepted and sent: ${message.slice(0, 48)}…`,
      r.status === 200 && r.json?.ok === true && got?.body.includes(message),
      `${r.status} ${r.body}`,
    );
  }

  console.log('The email');
  resetRate();
  for (const [value, label] of Object.entries(labels)) {
    r = await post({ type: value, message: `About ${value}: the zebra crossing lesson.` });
    const m = lastMessage();
    check(
      `"${label}": subject, recipient, body`,
      r.status === 200 &&
        m?.to === TO &&
        m.subject === `[Learn Civic Sense feedback] ${label}` &&
        m.body.startsWith(`Type: ${label}\nSent: `) &&
        m.body.includes(`About ${value}: the zebra crossing lesson.`) &&
        /Content-Type: text\/plain; charset=UTF-8/.test(m.headers) &&
        !m.body.includes('127.0.0.1'),
      JSON.stringify(m)?.slice(0, 160),
    );
  }
  resetRate();
  const crlf = `${'ab\r\n'.repeat(166)}ab`;
  r = await post({ type: 'other', message: crlf });
  check(
    'CRLF line breaks count once: 500 characters are accepted',
    r.status === 200,
    `${r.status} ${r.body}`,
  );
  r = await post({ type: 'other', message: 'क'.repeat(500) });
  check('500 Devanagari characters are accepted', r.status === 200, `${r.status} ${r.body}`);
  r = await post({ type: 'other', message: 'left‮right\u0007 and\n\n\n\nmore' });
  check(
    'direction overrides and control characters are removed, blank lines collapsed',
    r.status === 200 && lastMessage()?.body.includes('leftright and\n\nmore'),
    JSON.stringify(lastMessage()?.body),
  );

  console.log('Rate limits');
  resetRate();
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    r = await post({ type: 'other', message: `message number ${i + 1}` });
    statuses.push(r.status);
  }
  check(
    'five an hour from one sender, then 429',
    statuses.join() === '200,200,200,200,200,429' &&
      r.json?.code === 'rate' &&
      Number(r.headers['retry-after']) > 0,
    `${statuses} retry-after=${r.headers['retry-after']}`,
  );
  const stored = readFileSync(rateFile, 'utf8');
  check(
    'the rate file holds a hash, never the address',
    !stored.includes('127.0.0.1') && /"[0-9a-f]{64}"/.test(stored),
  );
  const now = Math.floor(Date.now() / 1000);
  writeFileSync(rateFile, JSON.stringify({ senders: {}, all: Array(200).fill(now - 60) }));
  r = await post({ type: 'other', message: 'one more today' });
  check(
    '200 a day from everyone together, then 429 "busy"',
    r.status === 429 && r.json?.code === 'busy',
  );
  writeFileSync(
    rateFile,
    JSON.stringify({
      senders: { ['a'.repeat(64)]: [now - 90000] },
      all: Array(200).fill(now - 90000),
    }),
  );
  r = await post({ type: 'other', message: 'a day later' });
  const after = JSON.parse(readFileSync(rateFile, 'utf8'));
  check(
    'entries older than a day are dropped when the form is next used',
    r.status === 200 && after.all.length === 1 && !('a'.repeat(64) in after.senders),
    readFileSync(rateFile, 'utf8').slice(0, 160),
  );

  console.log('Without JavaScript, and without the private settings');
  resetRate();
  r = await send({
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ type: 'correction', message: 'The fine in the table is out of date.' }),
  });
  check(
    'a plain form post that works goes to /feedback/sent/',
    r.status === 303 && r.headers.location === `${ORIGIN}/feedback/sent/`,
  );
  r = await send({
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ type: 'nonsense', message: 'The fine in the table is out of date.' }),
  });
  check(
    'a plain form post that fails goes to /feedback/not-sent/',
    r.status === 303 && r.headers.location === `${ORIGIN}/feedback/not-sent/`,
  );
  renameSync(configFile, `${configFile}.off`);
  r = await post({ type: 'other', message: 'no settings on the server' });
  check(
    'no private settings: 503 "unavailable", nothing sent',
    r.status === 503 && r.json?.code === 'unavailable',
  );
  renameSync(`${configFile}.off`, configFile);
} finally {
  server.kill();
  rmSync(root, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\n✓ every branch of the feedback endpoint behaves as specified');
