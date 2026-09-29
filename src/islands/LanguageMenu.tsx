import { Check, ChevronDown, Languages } from 'lucide-preact';
import { useMenuButton } from './useMenuButton';

/**
 * The top bar's language menu: English, ticked, and Hindi, listed but disabled
 * as coming soon. English is the only language the site publishes today, so
 * nothing is stored and choosing English simply closes the menu. When Hindi
 * ships, its item becomes a real choice (the same page in Hindi).
 *
 * Keyboard and pointer behaviour is the top bar's shared menu button
 * (useMenuButton.ts); the disabled item stays reachable by the arrow keys, as
 * the WAI-ARIA pattern asks, so a keyboard user hears that Hindi is coming.
 * On phones the button shows only its icon; its name still says the language.
 */

interface Props {
  strings: {
    /** "Language: {language}": the button's name. */
    label: string;
    /** The menu's name ("Language"). */
    menu: string;
    english: string;
    /** Hindi's English name, shown beside its own (हिन्दी). */
    hindi: string;
    /** The status beside Hindi ("Coming soon"). */
    soon: string;
  };
}

const MENU_ID = 'language-menu';

export default function LanguageMenu({ strings }: Props) {
  // English is item 0 and always the one ticked.
  const menu = useMenuButton({ count: 2, current: 0 });

  return (
    <span
      ref={menu.wrapRef}
      class="topbar-menu-wrap lang-menu-wrap"
      data-open={menu.open ? '' : undefined}
    >
      <button
        ref={menu.buttonRef}
        type="button"
        class="lang-toggle"
        aria-label={strings.label.replace('{language}', strings.english)}
        aria-haspopup="menu"
        aria-expanded={menu.open ? 'true' : 'false'}
        aria-controls={MENU_ID}
        onClick={menu.onButtonClick}
        onKeyDown={menu.onButtonKeyDown}
      >
        <Languages class="icon" aria-hidden="true" />
        <span class="lang-toggle-label">{strings.english}</span>
        <ChevronDown class="icon lang-toggle-caret" aria-hidden="true" />
      </button>
      <div
        id={MENU_ID}
        class="topbar-menu lang-menu"
        role="menu"
        aria-label={strings.menu}
        tabIndex={-1}
        hidden={!menu.open}
        onKeyDown={menu.onMenuKeyDown}
      >
        <button
          ref={menu.itemRef(0)}
          type="button"
          role="menuitemradio"
          aria-checked="true"
          tabIndex={-1}
          class="topbar-menu-item"
          onClick={() => menu.closeMenu(true)}
        >
          <span class="topbar-menu-label">{strings.english}</span>
          <Check class="icon topbar-menu-check" aria-hidden="true" />
        </button>
        <button
          ref={menu.itemRef(1)}
          type="button"
          role="menuitemradio"
          aria-checked="false"
          aria-disabled="true"
          tabIndex={-1}
          class="topbar-menu-item"
        >
          <span class="topbar-menu-label">
            <span lang="hi">हिन्दी</span> <span class="lang-gloss">{strings.hindi}</span>
          </span>{' '}
          <span class="lang-soon">{strings.soon}</span>
        </button>
      </div>
    </span>
  );
}
