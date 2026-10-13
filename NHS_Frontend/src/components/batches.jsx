// A batch: its card, and the bar that splits it by group.
import { Link } from 'react-router-dom';
import { groupShort } from '../lib/format.js';
import { GROUPS, isJubilee, THIS_YEAR } from '../lib/school.js';

/** Batch summary: total plus the per-group split, used at the top of a batch roster. */
export function BatchSummary({ batch: b }) {
  return (
    <div className="batch-summary legend">
      {GROUPS.map(g => <span key={g.name}><i className={g.cls} />{groupShort(g.name)}<b className="num">{b.groups?.[g.name] || 0}</b></span>)}
    </div>
  );
}
export function GroupBar({ groups, total }) {
  return (
    <div className="gbar" role="img"
      aria-label={GROUPS.map(g => `${groups?.[g.name] || 0} ${g.name}`).join(', ')}>
      {GROUPS.map(g => groups?.[g.name] ? <i key={g.name} className={g.cls} style={{ width: `${(groups[g.name] / total) * 100}%` }} /> : null)}
    </div>
  );
}

/** `detail` adds each group's count under the bar; `top` marks the biggest batch. */
export function BatchCard({ batch: b, detail, top }) {
  const jub = isJubilee(b.year);
  return (
    <Link className={`card card-link batch${jub ? ' is-jubilee' : ''}`} to={`/directory?batch=${b.year}`}
      aria-label={`Batch ${b.year}, ${b.count} alumni`}>
      <div className="batch-top">
        <span className="batch-year num">{b.year}</span>
        {jub ? <span className="badge badge-accent">{THIS_YEAR - b.year} yrs</span>
          : top && <span className="badge badge-brand">Largest</span>}
      </div>
      <GroupBar groups={b.groups} total={b.count} />
      <span className="batch-count"><b className="num">{b.count}</b> alumni</span>
      {detail && (
        <span className="batch-split">
          {GROUPS.map(g => <span key={g.name} title={g.name}><i className={g.cls} /><span className="num">{b.groups?.[g.name] || 0}</span></span>)}
        </span>
      )}
    </Link>
  );
}
