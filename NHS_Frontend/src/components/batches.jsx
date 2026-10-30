// A batch: its card, and the bar that splits it by group.
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
export function GroupBar({ groups, total }) {
  return (
    <div className="gbar" role="img"
      aria-label={GROUPS.map(g => `${groups?.[g.name] || 0} ${g.name}`).join(', ')}>
      {GROUPS.map(g => groups?.[g.name] ? <i key={g.name} className={g.cls} style={{ width: `${(groups[g.name] / total) * 100}%` }} /> : null)}
    </div>
  );
}

/** `detail` adds the active members and each group's count under the bar. */
export function BatchCard({ batch: b, detail }) {
  return (
    <Link className="card card-link batch" to={`/directory?batch=${b.year}`}
      aria-label={`Batch ${b.year}, ${b.count} alumni`}>
      <div className="batch-top">
        <span className="batch-year num">{b.year}</span>
      </div>
      <GroupBar groups={b.groups} total={b.count} />
      <span className="batch-count"><b className="num">{b.count}</b> alumni</span>
      {detail && b.active > 0 && <span className="batch-active"><Icon name="verified" /><b className="num">{b.active}</b> active</span>}
      {detail && (
        <span className="batch-split">
          {GROUPS.map(g => <span key={g.name} title={g.name}><i className={g.cls} /><span className="num">{b.groups?.[g.name] || 0}</span></span>)}
        </span>
      )}
    </Link>
  );
}
