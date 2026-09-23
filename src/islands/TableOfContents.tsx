import { useEffect, useState } from 'preact/hooks';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** How far down the viewport the "reading line" sits. A heading counts as the
 *  current section once it has scrolled above this line. */
const READING_LINE = 0.3;

export default function TableOfContents({ items, label }: { items: TocItem[]; label: string }) {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (!items.length) return;
    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;

    // "Last heading above the reading line" is stable at every scroll step,
    // unlike an IntersectionObserver band that misses headings scrolled past
    // it in one go and leaves the marker one or two sections behind.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      let current = targets[0]!.id;
      for (const t of targets) {
        if (t.getBoundingClientRect().top <= line) current = t.id;
        else break;
      }
      // At the very bottom the last section is the one being read even if its
      // heading never crosses the line on short pages.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atEnd ? targets[targets.length - 1]!.id : current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  if (!items.length) return null;

  return (
    <nav class="toc" aria-label={label}>
      <p class="toc-title">{label}</p>
      <ol class="toc-list">
        {items.map((it) => (
          <li key={it.id} class={`toc-item toc-${it.level} ${active === it.id ? 'active' : ''}`}>
            <a href={`#${it.id}`} aria-current={active === it.id ? 'location' : undefined}>
              {it.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
