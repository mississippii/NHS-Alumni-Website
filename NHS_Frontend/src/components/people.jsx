// A person in a list: directory row, batch roster card, and the small profile card.
import { Link } from 'react-router-dom';
import { fullName, groupShort, initials, memorialLine, studentId, tint } from '../lib/format.js';
import { Avatar } from './Avatar.jsx';
import { Icon } from './Icon.jsx';

const place = p => (p.city ? `${p.city}${p.country && p.country !== 'Bangladesh' ? `, ${p.country}` : ''}` : null);
/** What a card says about someone: where they work, else their highest education, else nothing. */
const affil = p => ((p.joined || p.memorial) && (p.org || p.edu)) || null;
/** The mark after a name: blue tick for a verified member, a ribbon for someone who passed away. */
const NameMark = ({ p }) => (p.memorial ? <span className="memorial-ic" title="Remembering"><Icon name="ribbon" /><span className="sr-only">Remembering</span></span>
  : p.joined ? <Icon name="verified" /> : null);
/** One directory row: a list item on phones, a table row on desktop. */
export function PersonRow({ person: p }) {
  return (
    <Link className="person" to={`/alumni/${studentId(p.id)}`}>
      <Avatar person={p} />
      <div className="person-main">
        <div className="person-name"><span>{fullName(p)}</span><NameMark p={p} /></div>
        <div className="person-meta">Batch {p.batch} · {groupShort(p.group)}{affil(p) ? ` · ${affil(p)}` : ''}</div>
      </div>
      <span className="person-col num">{p.batch}</span>
      <span className="person-col">{p.group}</span>
      <span className={`person-col${affil(p) ? '' : ' muted'}`}>{p.joined ? affil(p) || '—' : p.memorial ? affil(p) || memorialLine(p) : 'Not joined yet'}</span>
      <span className={`person-col${place(p) ? '' : ' muted'}`}>{place(p) || '—'}</span>
      <Icon name="chevron" className="ic chev" />
    </Link>
  );
}

export function PeopleList({ people, loading, head = true }) {
  return (
    <div className="people">
      {head && (
        <div className="people-head" aria-hidden="true">
          <span /><span>Name</span><span>Batch</span><span>Group</span><span>Work / Study</span><span>Location</span><span />
        </div>
      )}
      {people.map(p => <PersonRow key={p.id} person={p} />)}
      {loading && Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="person-skel" aria-hidden="true">
          <span className="avatar" />
          <span className="skeleton skel-line" style={{ '--w': `${40 + (i * 13) % 35}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Batch roster card: photo on the top half, then name, then where they work or study. */
export function StudentCard({ person: p }) {
  return (
    <Link className="card card-link student" to={`/alumni/${studentId(p.id)}`}>
      <span className={`student-photo ${p.photo ? '' : tint(p.group)}`} aria-hidden="true">
        {p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span>{initials(p.name)}</span>}
      </span>
      <span className="student-body">
        <span className="student-name">{fullName(p)}<NameMark p={p} /></span>
        {p.memorial ? <span className="student-work muted">{memorialLine(p)}</span>
          : p.joined ? affil(p) && <span className="student-work">{affil(p)}</span> : <span className="student-work muted">Not joined yet</span>}
      </span>
    </Link>
  );
}

export function StudentGrid({ people, loading }) {
  return (
    <div className="students">
      {people.map(p => <StudentCard key={p.id} person={p} />)}
      {loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton student-skel" aria-hidden="true" />)}
    </div>
  );
}
export function ProfileCard({ person: p }) {
  return (
    <Link className="card card-link profile-card" to={`/alumni/${studentId(p.id)}`}>
      <Avatar person={p} size="lg" />
      <div>
        <b>{fullName(p)}</b>
        {affil(p) && <span>{affil(p)}</span>}
        <span>Batch {p.batch}{place(p) ? ` · ${place(p)}` : ''}</span>
      </div>
    </Link>
  );
}
