import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildShareLinks,
  canNativeShare,
  invokeNativeShare,
  copyToClipboard,
} from '../../src/lib/share';

const URL = 'https://learncivicsense.in/traffic/honking-discipline/the-case-against-honking/';
const TITLE = 'The case against honking, yes, even in Bengaluru';

describe('buildShareLinks()', () => {
  const links = buildShareLinks({ url: URL, title: TITLE });
  const encURL = encodeURIComponent(URL);
  const encTitle = encodeURIComponent(TITLE);

  it('WhatsApp puts title then URL (space-separated) in text', () => {
    expect(links.whatsapp).toBe(`https://api.whatsapp.com/send?text=${encTitle}%20${encURL}`);
  });

  it('X/Twitter uses text + url + the via handle', () => {
    expect(links.twitter).toBe(
      `https://twitter.com/intent/tweet?text=${encTitle}&url=${encURL}&via=learncivicsense`,
    );
  });

  it('LinkedIn shares the URL offsite', () => {
    expect(links.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encURL}`);
  });

  it('Telegram passes url + text', () => {
    expect(links.telegram).toBe(`https://t.me/share/url?url=${encURL}&text=${encTitle}`);
  });

  it('Email is a mailto with subject + body', () => {
    expect(links.email).toBe(`mailto:?subject=${encTitle}&body=${encURL}`);
  });

  it('percent-encodes commas and slashes (no raw delimiters leak)', () => {
    expect(links.whatsapp).not.toMatch(/, /); // the comma in the title is encoded
    expect(encTitle).toContain('%2C');
  });
});

describe('canNativeShare() / invokeNativeShare()', () => {
  const nav = globalThis.navigator as Navigator & { share?: unknown };
  afterEach(() => {
    if ('share' in nav) delete (nav as { share?: unknown }).share;
    vi.restoreAllMocks();
  });

  it('canNativeShare reflects navigator.share availability', () => {
    expect(canNativeShare()).toBe(false);
    Object.defineProperty(nav, 'share', { value: () => Promise.resolve(), configurable: true });
    expect(canNativeShare()).toBe(true);
  });

  it('invokeNativeShare calls navigator.share with {title,text,url} and returns true', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(nav, 'share', { value: share, configurable: true });
    const ok = await invokeNativeShare({ title: TITLE, text: 'desc', url: URL });
    expect(ok).toBe(true);
    expect(share).toHaveBeenCalledWith({ title: TITLE, text: 'desc', url: URL });
  });

  it('returns false (no throw) when the user dismisses the sheet', async () => {
    Object.defineProperty(nav, 'share', {
      value: () => Promise.reject(new DOMException('aborted', 'AbortError')),
      configurable: true,
    });
    await expect(invokeNativeShare({ title: TITLE, text: 'd', url: URL })).resolves.toBe(false);
  });

  it('returns false when the Web Share API is unavailable', async () => {
    await expect(invokeNativeShare({ title: TITLE, text: 'd', url: URL })).resolves.toBe(false);
  });
});

describe('copyToClipboard()', () => {
  const nav = globalThis.navigator as Navigator & { clipboard?: unknown };
  afterEach(() => {
    if ('clipboard' in nav) delete (nav as { clipboard?: unknown }).clipboard;
    vi.restoreAllMocks();
  });

  it('writes the text and returns true', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(nav, 'clipboard', { value: { writeText }, configurable: true });
    const ok = await copyToClipboard(URL);
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(URL);
  });

  it('returns false when the clipboard API is unavailable', async () => {
    // happy-dom provides a default navigator.clipboard; null it out to simulate absence.
    Object.defineProperty(nav, 'clipboard', { value: undefined, configurable: true });
    await expect(copyToClipboard(URL)).resolves.toBe(false);
  });

  it('returns false (no throw) when writeText rejects (blocked/insecure)', async () => {
    Object.defineProperty(nav, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('blocked')) },
      configurable: true,
    });
    await expect(copyToClipboard(URL)).resolves.toBe(false);
  });
});
