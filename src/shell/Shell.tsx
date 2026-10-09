import { hashFor, type Route } from '../data/nav.ts';
import { cx } from '../ui/kit.tsx';

/** The ParseLens mark: a brass-rimmed loupe magnifying a precedence relation (⋗) over a table grid. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="pl-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brass-hi)" /><stop offset="0.5" stopColor="var(--brass)" /><stop offset="1" stopColor="var(--brass-lo)" />
        </linearGradient>
        <radialGradient id="pl-glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFDF6" /><stop offset="1" stopColor="var(--plate-2)" />
        </radialGradient>
        <clipPath id="pl-clip"><circle cx="17" cy="17" r="11.5" /></clipPath>
      </defs>
      <path d="M25.5 25.5 36 36" stroke="var(--brass-lo)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M25.5 25.5 35 35" stroke="url(#pl-rim)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="17" r="11.5" fill="url(#pl-glass)" />
      <g clipPath="url(#pl-clip)" stroke="var(--line)" strokeWidth="0.8">
        <path d="M5 11h24M5 23h24M11 5v24M23 5v24" />
      </g>
      <path d="M13.5 12.5 21 17l-7.5 4.5" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 12.5a9.5 9.5 0 0 1 5-4.6" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="17" cy="17" r="12" fill="none" stroke="url(#pl-rim)" strokeWidth="3" />
      <circle cx="17" cy="17" r="13.6" fill="none" stroke="var(--brass-lo)" strokeWidth="0.8" />
    </svg>
  );
}

export function Rail({ route }: { route: Route }) {
  const ch = route.page === 'chapter' ? route.chapter.id : null;
  return (
    <header className="rail">
      <a className="rail__brand" href={hashFor()} aria-current={route.page === 'home' ? 'page' : undefined}>
        <Logo />
        <span className="wordmark">Parse<span className="wordmark__lens">Lens</span></span>
      </a>
      <nav className="rail__nav" aria-label="Chapters">
        <a href={hashFor('opp', 'grammar')} className={cx('rail__link', ch === 'opp' && 'is-current')} aria-current={ch === 'opp' ? 'page' : undefined}>Bottom-Up</a>
        <a href={hashFor('regex', 'tree')} className={cx('rail__link', ch === 'regex' && 'is-current')} aria-current={ch === 'regex' ? 'page' : undefined}>Regex → DFA</a>
      </nav>
    </header>
  );
}
