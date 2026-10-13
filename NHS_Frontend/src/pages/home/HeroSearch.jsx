import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAlumni } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Icon } from '../../components/Icon.jsx';
import { fullName, groupShort, studentId } from '../../lib/format.js';

/** "Hasan 2010" → name "Hasan" in batch 2010; a year alone opens that batch. SSC rolls are 6 digits, so they never look like a year. */
const parseSearch = text => {
  const year = text.match(/\b(19[5-9]\d|20\d\d)\b/)?.[1];
  return { q: (year ? text.replace(year, '') : text).replace(/\s+/g, ' ').trim(), batch: year ? +year : 0 };
};
const searchUrl = text => {
  const { q, batch } = parseSearch(text);
  const p = new URLSearchParams();
  if (batch) p.set('batch', batch);
  if (q) p.set('q', q);
  return `/directory?${p}`;
};

/** Search by name, batch year or Student ID, with live suggestions; Enter opens the full directory. */
export default function HeroSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return; }
    let live = true;
    const t = setTimeout(() => listAlumni({ ...parseSearch(term), size: 5 }).then(r => live && setHits(r), () => live && setHits(null)), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const submit = e => {
    e.preventDefault();
    navigate(q.trim() ? searchUrl(q) : '/alumni');
  };

  return (
    <div className="search-box">
      <form className="search-form" role="search" onSubmit={submit}>
        <Icon name="search" />
        <label htmlFor="hero-q" className="sr-only">Search alumni by name, batch or Student ID</label>
        <input id="hero-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, batch or Student ID"
          autoComplete="off" enterKeyHint="search" aria-controls="hero-suggest" />
        <button className="btn btn-accent" type="submit">Search</button>
      </form>
      {hits && (
        <div className="suggest" id="hero-suggest" aria-live="polite">
          {hits.items.length === 0 && <p>No alumni match “{q.trim()}”.</p>}
          {hits.items.map(p => (
            <Link key={p.id} to={`/alumni/${studentId(p.id)}`}>
              <Avatar person={p} size="sm" />
              <span><b>{fullName(p)}</b><small>Batch {p.batch} · {groupShort(p.group)}</small></span>
            </Link>
          ))}
          {hits.total > hits.items.length && (
            <Link className="suggest-all" to={searchUrl(q)}>View all {hits.total} results</Link>
          )}
        </div>
      )}
    </div>
  );
}
