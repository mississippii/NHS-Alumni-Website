import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fullName, getStats, listAlumni, listBatches, listEvents, SCHOOL } from '../api.js';
import {
  Avatar, BatchCard, GROUPS, Icon, ProfileCard, SectionHead, groupShort, useAsync, useTitle,
} from '../components/ui.jsx';

/** Batches gliding past in a loop. The list is drawn twice so it wraps seamlessly; the copy is hidden from keyboards
 * and screen readers. Hover or focus pauses it; with "reduce motion" it becomes a plain swipeable row. */
function BatchMarquee({ batches }) {
  return (
    <div className="marquee" style={{ '--dur': `${batches.length * 3.5}s` }}>
      <div className="marquee-track">
        {batches.map(b => <BatchCard key={b.year} batch={b} />)}
        <div className="marquee-copy" aria-hidden="true" inert="">
          {batches.map(b => <BatchCard key={b.year} batch={b} />)}
        </div>
      </div>
    </div>
  );
}

/** Search with live name suggestions; Enter opens the full directory. */
function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return; }
    let live = true;
    const t = setTimeout(() => listAlumni({ q: term, size: 5 }).then(r => live && setHits(r), () => live && setHits(null)), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const submit = e => {
    e.preventDefault();
    navigate(q.trim() ? `/directory?q=${encodeURIComponent(q.trim())}` : '/directory');
  };

  return (
    <div className="search-box">
      <form className="search-form" role="search" onSubmit={submit}>
        <Icon name="search" />
        <label htmlFor="hero-q" className="sr-only">Search alumni by name or SSC roll</label>
        <input id="hero-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Name or SSC roll"
          autoComplete="off" enterKeyHint="search" aria-controls="hero-suggest" />
        <button className="btn btn-accent" type="submit">Search</button>
      </form>
      {hits && (
        <div className="suggest" id="hero-suggest" aria-live="polite">
          {hits.items.length === 0 && <p>No alumni match “{q.trim()}”.</p>}
          {hits.items.map(p => (
            <Link key={p.id} to={`/alumni/${p.id}`}>
              <Avatar person={p} size="sm" />
              <span><b>{fullName(p)}</b><small>Batch {p.batch} · {groupShort(p.group)}</small></span>
            </Link>
          ))}
          {hits.total > hits.items.length && (
            <Link className="suggest-all" to={`/directory?q=${encodeURIComponent(q.trim())}`}>View all {hits.total} results</Link>
          )}
        </div>
      )}
    </div>
  );
}

const fmtDate = iso => {
  const d = new Date(iso + 'T00:00:00');
  return { day: d.getDate(), mon: d.toLocaleString('en', { month: 'short' }).toUpperCase() };
};

export default function Home() {
  useTitle(null);
  const batches = useAsync(listBatches, []);
  const stats = useAsync(getStats, []);
  const groups = useAsync(() => listAlumni({ size: 1 }), []);
  const joined = useAsync(() => listAlumni({ joined: true, sort: 'newest', size: 6 }), []);
  const events = useAsync(listEvents, []);
  const s = stats.data;
  const total = s?.alumni || 0;

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true"><img className="hero-photo" src="/school.jpg" alt="" /></div>
        <div className="wrap">
          <p className="hero-eyebrow">{SCHOOL.name} Alumni Network</p>
          <h1><span>One School.</span><span>Many <em className="kw">Journeys.</em></span><span>One <em className="kw">Community.</em></span></h1>
          <p className="hero-sub">Find your classmates from every batch, and stay connected.</p>
          <HeroSearch />
          <dl className="hero-stats">
            <div><dt>Alumni</dt><dd className="num">{s ? s.alumni.toLocaleString() : '—'}</dd></div>
            <div><dt>Batches</dt><dd className="num">{s ? s.batches : '—'}</dd></div>
            <div><dt>Since</dt><dd className="num">1958</dd></div>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead title="Find your batch" desc="Your batch is the year you first sat the SSC exam." to="/batches" linkLabel="All batches" />
          {batches.data ? <BatchMarquee batches={[...batches.data].reverse()} /> : (
            <div className="batch-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton batch-skel" />)}</div>
          )}
        </div>
      </section>

      {groups.data && (
        <section className="section section-alt">
          <div className="wrap">
            <SectionHead title="Browse by group" />
            <div className="group-grid">
              {GROUPS.map(g => {
                const n = groups.data.facets.group[g.name] || 0;
                return (
                  <Link key={g.name} className="card card-link group-tile" to={`/directory?group=${encodeURIComponent(g.name)}`}>
                    <span className={`group-icon ${g.cls}`}><Icon name={g.icon} /></span>
                    <div><b>{g.name}</b><span className="num">{n.toLocaleString()} alumni{total ? ` · ${Math.round((n / total) * 100)}%` : ''}</span></div>
                    <Icon name="chevron" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {joined.data?.items.length > 0 && (
        <section className="section">
          <div className="wrap">
            <SectionHead title="Recently joined" to="/directory" />
            <div className="profile-cards">{joined.data.items.map(p => <ProfileCard key={p.id} person={p} />)}</div>
          </div>
        </section>
      )}

      <section className="section" id="events">
        <div className="wrap">
          <SectionHead title="Upcoming events" />
          {events.data?.length > 0 ? (
            <div className="events">
              {events.data.map(e => {
                const d = fmtDate(e.date);
                return (
                  <article className="card event" key={e.id}>
                    <time className="event-date" dateTime={e.date}><span>{d.mon}</span><b className="num">{d.day}</b></time>
                    <div>
                      <h3>{e.title}</h3>
                      {(e.place || e.time) && <p>{[e.place, e.time].filter(Boolean).join(' · ')}</p>}
                      {e.details && <p className="details">{e.details}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card events-empty"><Icon name="calendar" />No reunions announced yet. Check back soon.</div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta">
            <div>
              <h2>Can’t find a classmate?</h2>
              <p>Search by name, or open a batch to see everyone who sat SSC that year.</p>
            </div>
            <Link className="btn btn-accent" to="/directory">Open directory</Link>
          </div>
        </div>
      </section>
    </>
  );
}
