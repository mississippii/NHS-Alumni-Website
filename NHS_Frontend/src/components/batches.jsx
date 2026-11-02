// A batch: the per-group summary on its roster page, and its row in the Alumni ledger.
import { Link } from 'react-router-dom';
import { groupShort } from '../lib/format.js';
import { GROUPS } from '../lib/school.js';
import { Icon } from './Icon.jsx';

/** Batch summary: total plus the per-group split, used at the top of a batch roster. */
export function BatchSummary({ batch: b }) {
  return (
    <div className="batch-summary legend">
      {GROUPS.map(g => <span key={g.name}><i className={g.cls} />{groupShort(g.name)}<b className="num">{b.groups?.[g.name] || 0}</b></span>)}
    </div>
  );
}
/** One row of the Alumni ledger: the year, the number of alumni and how many have joined. */
export function BatchRow({ batch: b }) {
  const split = GROUPS.map(g => `${b.groups?.[g.name] || 0} ${g.name}`).join(', ');
  return (
    <li>
      <Link className="ledger-row" to={`/directory?batch=${b.year}`}
        aria-label={`Batch ${b.year}: ${b.count} alumni (${split}), ${b.active || 0} joined`}>
        <span className="ledger-year num">{b.year}</span>
        <span className="ledger-count num">{b.count}</span>
        <span className="ledger-joined num">{b.active > 0 ? <><Icon name="verified" />{b.active}</> : '–'}</span>
        <Icon name="chevron" className="ic ledger-chev" />
      </Link>
    </li>
  );
}
