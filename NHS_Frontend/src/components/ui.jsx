import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SCHOOL, THIS_YEAR, fullName, isJubilee, studentId } from '../api.js';

/* ---------- icons (24px stroke set) ---------- */
const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  bag: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  cap: <><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  flask: <><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3" /><path d="M7 15h10" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
  verified: <><path d="M12 2.5 14.4 4l2.8-.2 1.2 2.6 2.5 1.3-.3 2.8L22 13l-1.6 2.3.3 2.8-2.5 1.3-1.2 2.6-2.8-.2L12 23.5 9.6 22l-2.8.2-1.2-2.6L3.1 18.3l.3-2.8L2 13l1.4-2.5-.3-2.8 2.5-1.3L6.8 3.8l2.8.2z" fill="currentColor" stroke="none" /><path d="m8.5 13 2.5 2.5 4.5-5" stroke="#fff" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  drop: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />,
  idcard: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.3 1.6-2 3-2s2.5.7 3 2M14 10h4M14 14h3" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" /></>,
};
export const Icon = ({ name, className = 'ic' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
);

/* ---------- brand logos (Facebook, X, YouTube paths: Simple Icons, CC0; LinkedIn drawn here) ---------- */
export const SOCIAL = {
  facebook: { label: 'Facebook', color: '#0866FF', svg: <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" /> },
  linkedin: {
    label: 'LinkedIn', color: '#0A66C2',
    svg: <><rect x="1" y="1" width="22" height="22" rx="4" /><g fill="#fff"><circle cx="6.6" cy="6.7" r="1.7" /><rect x="5.1" y="9.4" width="3" height="9.4" rx=".3" /><path d="M10.4 9.4h2.9v1.3c.5-.8 1.5-1.5 3-1.5 2.8 0 3.4 1.8 3.4 4.2v5.4h-3v-4.8c0-1.1-.1-2.5-1.6-2.5s-1.8 1.2-1.8 2.4v4.9h-2.9z" /></g></>,
  },
  youtube: { label: 'YouTube', color: '#FF0000', svg: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /> },
  twitter: { label: 'X (Twitter)', color: 'var(--text)', svg: <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" /> },
};

/** Round brand-logo buttons for a student's social profiles. */
export function SocialLinks({ links, name }) {
  if (!links?.length) return null;
  return (
    <div className="socials">
      {links.map(l => {
        const s = SOCIAL[l.type];
        return s && (
          <a key={l.type} className={`social social-${l.type}`} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
            aria-label={`${name} on ${s.label}`} title={s.label} style={{ '--brand-c': s.color }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{s.svg}</svg>
          </a>
        );
      })}
    </div>
  );
}

/* ---------- helpers + hooks ---------- */
export const yy = y => '’' + String(y).slice(2);
export const groupShort = g => (g === 'Business Studies' ? 'Business' : g);
export const GROUPS = [
  { name: 'Science', cls: 'g-science', icon: 'flask' },
  { name: 'Business Studies', cls: 'g-business', icon: 'bag' },
  { name: 'Humanities', cls: 'g-humanities', icon: 'book' },
];
/** Initials take their group's colour: "tint t-science" etc., empty when unknown. */
export const tint = group => {
  const g = GROUPS.find(x => x.name === group);
  return g ? `tint t-${g.cls.slice(2)}` : '';
};

/** Fetch-on-deps hook with loading + error state. */
export function useAsync(fn, deps) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    set(s => ({ ...s, loading: true, error: null }));
    fn().then(data => live && set({ data, error: null, loading: false }),
      error => live && set({ data: null, error, loading: false }));
    return () => { live = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Sets the browser tab title for the current page. */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SCHOOL.name} Alumni` : `${SCHOOL.name} Alumni`;
  }, [title]);
}

export function soon(what) {
  window.dispatchEvent(new CustomEvent('toast', { detail: `${what} is coming soon.` }));
}

/* ---------- primitives ---------- */
const initials = name => {
  const w = name.split(' ').filter(x => x && x !== 'Md.');
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

export function Avatar({ person, size = '' }) {
  return (
    <span className={`avatar ${size && `avatar-${size}`} ${person.photo ? '' : tint(person.group)}`} aria-hidden="true">
      {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : initials(person.name)}
    </span>
  );
}

export function PageHeader({ crumbs, title, desc, children }) {
  return (
    <header className="page-header">
      <div className="wrap">
        {crumbs && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            {crumbs.map(([to, label]) => (
              <Fragment key={label}><Icon name="chevron" />{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</Fragment>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
        {children}
      </div>
    </header>
  );
}

export function SectionHead({ title, desc, to, linkLabel = 'View all' }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
      {to && <Link className="link" to={to}>{linkLabel}<Icon name="arrow" /></Link>}
    </div>
  );
}

export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- people ---------- */
const place = p => (p.city ? `${p.city}${p.country && p.country !== 'Bangladesh' ? `, ${p.country}` : ''}` : null);
/** What a card says about someone: where they work, else their highest education, else nothing. */
const affil = p => (p.joined && (p.org || p.edu)) || null;

/** One directory row: a list item on phones, a table row on desktop. */
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export function PersonRow({ person: p }) {
  return (
    <Link className="person" to={`/alumni/${studentId(p.id)}`}>
      <Avatar person={p} />
      <div className="person-main">
        <div className="person-name"><span>{fullName(p)}</span>{p.joined && <Icon name="verified" />}</div>
        <div className="person-meta">Batch {p.batch} · {groupShort(p.group)}{affil(p) ? ` · ${affil(p)}` : ''}</div>
      </div>
      <span className="person-col num">{p.batch}</span>
      <span className="person-col">{p.group}</span>
      <span className={`person-col${affil(p) ? '' : ' muted'}`}>{p.joined ? affil(p) || '—' : 'Not joined yet'}</span>
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


/** Yearbook-style card used when browsing one batch. */
/** Batch roster card: photo on the top half, then name, then where they work or study. */
export function StudentCard({ person: p }) {
  return (
    <Link className="card card-link student" to={`/alumni/${studentId(p.id)}`}>
      <span className={`student-photo ${p.photo ? '' : tint(p.group)}`} aria-hidden="true">
        {p.photo ? <img src={p.photo} alt="" loading="lazy" /> : <span>{initials(p.name)}</span>}
      </span>
      <span className="student-body">
        <span className="student-name">{fullName(p)}{p.joined && <Icon name="verified" />}</span>
        {p.joined ? affil(p) && <span className="student-work">{affil(p)}</span> : <span className="student-work muted">Not joined yet</span>}
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

/** Batch summary: total plus the per-group split, used at the top of a batch roster. */
export function BatchSummary({ batch: b }) {
  return (
    <div className="batch-summary">
      <GroupBar groups={b.groups} total={b.count} />
      <div className="legend">
        {GROUPS.map(g => <span key={g.name}><i className={g.cls} />{g.name} <b className="num">{b.groups?.[g.name] || 0}</b></span>)}
      </div>
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

/* ---------- batches ---------- */
export function GroupBar({ groups, total }) {
  return (
    <div className="gbar" role="img"
      aria-label={GROUPS.map(g => `${groups?.[g.name] || 0} ${g.name}`).join(', ')}>
      {GROUPS.map(g => groups?.[g.name] ? <i key={g.name} className={g.cls} style={{ width: `${(groups[g.name] / total) * 100}%` }} /> : null)}
    </div>
  );
}

export function GroupLegend() {
  return (
    <div className="legend">
      {GROUPS.map(g => <span key={g.name}><i className={g.cls} />{g.name}</span>)}
    </div>
  );
}

export function BatchCard({ batch: b }) {
  const jub = isJubilee(b.year);
  return (
    <Link className={`card card-link batch${jub ? ' is-jubilee' : ''}`} to={`/directory?batch=${b.year}`}
      aria-label={`Batch ${b.year}, ${b.count} alumni`}>
      <div className="batch-top">
        <span className="batch-year num">{b.year}</span>
        {jub && <span className="badge badge-accent">{THIS_YEAR - b.year} yrs</span>}
      </div>
      <GroupBar groups={b.groups} total={b.count} />
      <span className="batch-count"><b className="num">{b.count}</b> alumni</span>
    </Link>
  );
}
