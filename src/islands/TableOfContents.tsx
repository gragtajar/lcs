import { useEffect, useState } from 'preact/hooks';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export default function TableOfContents({ items, label }: { items: TocItem[]; label: string }) {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (!items.length || typeof IntersectionObserver === 'undefined') return;

    const targets = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;

    // Track which targets are in the upper third of the viewport. The one closest
    // to the top counts as the active section.
    const visible = new Map<string, number>();

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size > 0) {
          // Pick the first item (in TOC order) that's currently visible.
          for (const it of items) {
            if (visible.has(it.id)) {
              setActive(it.id);
              break;
            }
          }
        } else if (targets[0]) {
          // None in view (we're between sections); keep last active.
        }
      },
      { rootMargin: '-72px 0px -65% 0px', threshold: [0, 0.5, 1] },
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav class="toc" aria-label={label}>
      <p class="toc-title">{label}</p>
      <ol class="toc-list">
        {items.map((it) => (
          <li key={it.id} class={`toc-item toc-${it.level} ${active === it.id ? 'active' : ''}`}>
            <a href={`#${it.id}`}>{it.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
