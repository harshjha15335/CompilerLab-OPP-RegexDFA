// The Verification tab: how a stage's result is checked independently, and the live outcome.
import { useMemo, useState, type ReactNode } from 'react';
import type { Verification } from '../verify/independent.ts';
import { cx, Tag } from './kit.tsx';

export function VerifyPanel({ v }: { v: Verification }) {
  const fails = v.checks.filter((c) => c.state === 'fail').length;
  return (
    <section className="verify" aria-label="Verification">
      <p className="verify__head">
        {fails ? <Tag kind="reject">{fails === 1 ? '1 check failed' : `${fails} checks failed`}</Tag>
          : <Tag kind="accept">All {v.checks.filter((c) => c.state === 'pass').length} checks passed</Tag>}
      </p>
      <h2 className="label">How this is verified</h2>
      <p className="verify__method">{v.method}</p>
      <h2 className="label">Checks, run live on this input</h2>
      <ul className="verify__list">
        {v.checks.map((c, i) => (
          <li key={i} className={cx('verify__item', `is-${c.state}`)}>
            <Tag kind={c.state === 'pass' ? 'accept' : c.state === 'fail' ? 'reject' : 'plain'}>{c.state === 'pass' ? 'Pass' : c.state === 'fail' ? 'Fail' : 'Note'}</Tag>
            <div><p className="verify__label">{c.label}</p>{c.detail && <p className="verify__detail">{c.detail}</p>}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const verdictWord = (v: Verification) => (v.checks.some((c) => c.state === 'fail') ? '✗' : '✓');

/** "This step" and "Verification" tabs at the top of an inspector. */
export function StepTabs({ make, subject, children, id, first = 'This step' }:
  { make: () => Verification; subject: unknown; children: ReactNode; id: string; first?: string }) {
  const [tab, setTab] = useState<'step' | 'verify'>('step');
  // checks run once per input (subject), never per replay step
  const verify = useMemo(make, [subject]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Inspector views">
        {([['step', first], ['verify', `Verification ${verdictWord(verify)}`]] as const).map(([t, text]) => (
          <button key={t} type="button" role="tab" id={`${id}-tab-${t}`} aria-selected={tab === t} aria-controls={`${id}-panel`}
            className={cx('tabs__tab', tab === t && 'is-on')} onClick={() => setTab(t)}>{text}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="steptabs__panel">
        {tab === 'step' ? children : <VerifyPanel v={verify} />}
      </div>
    </>
  );
}
