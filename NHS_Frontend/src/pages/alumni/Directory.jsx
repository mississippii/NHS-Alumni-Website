import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listAlumni, listBatches } from '../../api/public.js';
import { BatchSummary } from '../../components/batches.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { PeopleList, StudentGrid } from '../../components/people.jsx';
import { useAsync, useTitle } from '../../lib/hooks.js';
import { BLOOD_GROUPS, GROUPS } from '../../lib/school.js';

// All filter state lives in the URL, so results are shareable and Back works.
function readFilters(sp) {
  return {
    q: sp.get('q') || '',
    batch: +sp.get('batch') || 0,
    groups: sp.getAll('group'),
    industries: sp.getAll('field'),
    blood: sp.getAll('blood'),
    country: sp.get('country') || '',
    joined: sp.get('joined') === 'true',
    sort: sp.get('sort') || 'id',
  };
}

export default function Directory() {
  const [sp, setSp] = useSearchParams();
  const f = readFilters(sp);
  const key = sp.toString();
  const batches = useAsync(listBatches, []);
  const [q, setQ] = useState(f.q);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  // Results accumulate as "Load more" fetches the next page; any filter change starts over.
  const [res, setRes] = useState({ items: [], page: 0, pages: 1, total: 0, facets: null, loading: true, error: null });
  useTitle(f.batch ? `Batch ${f.batch}` : 'Alumni directory');

  useEffect(() => {
    let live = true;
    setRes(r => ({ ...r, loading: true, error: null, items: [], page: 0 }));
    listAlumni({ ...f, page: 1 }).then(d => live && setRes({ ...d, loading: false, error: null }),
      error => live && setRes(r => ({ ...r, loading: false, error })));
    return () => { live = false; };
  }, [key, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    setRes(r => ({ ...r, loading: true, error: null }));
    listAlumni({ ...f, page: res.page + 1 }).then(
      d => setRes(r => ({ ...d, items: [...r.items, ...d.items], loading: false, error: null })),
      error => setRes(r => ({ ...r, loading: false, error })));
  };

  const update = fn => { const next = new URLSearchParams(sp); fn(next); setSp(next, { replace: true }); };
  const setOne = (k, v) => update(n => (v ? n.set(k, v) : n.delete(k)));
  const toggle = (k, v) => update(n => {
    const all = n.getAll(k);
    n.delete(k);
    (all.includes(v) ? all.filter(x => x !== v) : [...all, v]).forEach(x => n.append(k, x));
  });

  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => setOne('q', q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock page scroll behind the open filter; Escape closes it.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const esc = e => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', esc);
    return () => { document.body.style.overflow = ''; removeEventListener('keydown', esc); };
  }, [open]);

  const years = [...(batches.data || [])].reverse();
  const batchInfo = f.batch ? years.find(b => b.year === f.batch) : null;
  // Removable chips for what is filtered; the batch is the page itself, so it gets none.
  const chips = [
    f.q && ['q', null, `“${f.q}”`],
    ...f.groups.map(g => ['group', g, g]),
    f.blood[0] && ['blood', null, `Blood ${f.blood[0]}`],
    ...f.industries.map(g => ['field', g, g]),
    f.country && ['country', null, f.country],
    f.joined && ['joined', null, 'Joined only'],
  ].filter(Boolean);
  const filterCount = chips.filter(c => c[0] !== 'q').length;
  // Clearing keeps the batch you are looking at.
  const clearAll = () => { setQ(''); setSp(new URLSearchParams(f.batch ? { batch: f.batch } : {}), { replace: true }); };
  const removeChip = (k, v) => (v ? toggle(k, v) : k === 'q' ? (setQ(''), setOne('q', '')) : setOne(k, ''));
  const first = res.loading && !res.items.length;

  return (
    <>
      {batchInfo ? (
        <PageHeader crumbs={[['/alumni', 'Alumni'], [null, `Batch ${f.batch}`]]} title={`Batch ${f.batch}`}
          desc={<>{batchInfo.count.toLocaleString()} alumni · <b className="batch-active"><Icon name="verified" />Active {(batchInfo.active ?? 0).toLocaleString()}</b></>}>
          <BatchSummary batch={batchInfo} />
        </PageHeader>
      ) : (
        <PageHeader crumbs={[['/alumni', 'Alumni'], [null, 'Search']]} title="Find alumni" />
      )}

      <div className="wrap dir">
        <div className="toolbar">
          <label className="input-icon" htmlFor="q">
            <Icon name="search" />
            <input id="q" className="input" type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Name or Student ID" autoComplete="off" />
          </label>
          <button className="btn btn-secondary filter-btn" type="button" onClick={() => setOpen(true)}
            aria-haspopup="dialog">
            <Icon name="filter" /><span>Filter</span>{filterCount > 0 && <b className="num">{filterCount}</b>}
          </button>
        </div>

        {open && <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <div className="filters" role="dialog" aria-modal="true" aria-labelledby="filters-title">
            <div className="sheet-head">
              <h2 id="filters-title">Filter</h2>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" /></button>
            </div>
            <div className="sheet-body">
              <fieldset>
                <legend>Department</legend>
                {GROUPS.map(g => {
                  const n = res.facets?.group?.[g.name] ?? 0, on = f.groups.includes(g.name);
                  return (
                    <label key={g.name} className={`check${n || on ? '' : ' zero'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle('group', g.name)} />
                      <i className={`dot ${g.cls}`} aria-hidden="true" />{g.name}<span className="n num">{n}</span>
                    </label>
                  );
                })}
              </fieldset>
              <fieldset>
                <legend>Blood group</legend>
                {/* same grid as the profile form; tap the chosen one again for any blood group */}
                <div className="blood-grid">
                  {BLOOD_GROUPS.map(b => (
                    <button key={b} type="button" className="btn btn-secondary" aria-pressed={f.blood[0] === b}
                      onClick={() => setOne('blood', f.blood[0] === b ? '' : b)}>{b}</button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="sheet-foot">
              <button className="btn btn-secondary" type="button" onClick={clearAll} disabled={!filterCount}>Reset</button>
              <button className="btn btn-primary" type="button" onClick={() => setOpen(false)}>
                {res.loading ? 'Updating…' : `Show ${res.total.toLocaleString()} ${res.total === 1 ? 'result' : 'results'}`}
              </button>
            </div>
          </div>
        </>}

        <div>
          <div className="results-bar" aria-live="polite">
            <span className="count num">{first ? 'Loading…' : res.error && !res.items.length ? '' : `${res.total.toLocaleString()} ${res.total === 1 ? 'result' : 'results'}`}</span>
            {chips.map(([k, v, label]) => (
              <button key={k + v} type="button" className="chip chip-removable" onClick={() => removeChip(k, v)} aria-label={`Remove filter ${label}`}>
                {label}<Icon name="x" />
              </button>
            ))}
            {chips.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all</button>}
          </div>

          {res.error && !res.items.length ? (
            <div className="card">
              <Empty icon="info" title="Couldn’t load the directory"
                action={<button className="btn btn-primary" onClick={() => setRetry(r => r + 1)}>Try again</button>}>
                Check your connection and try again.
              </Empty>
            </div>
          ) : !first && !res.items.length ? (
            <div className="card">
              <Empty icon="search" title="No alumni found"
                action={<div className="btn-row"><button className="btn btn-secondary" onClick={clearAll}>Clear filters</button><Link className="btn btn-primary" to="/join">Join the network</Link></div>}>
                Try a different spelling, or remove a filter. Not listed? Add yourself.
              </Empty>
            </div>
          ) : f.batch ? (
            <StudentGrid people={res.items} loading={first} />
          ) : (
            <PeopleList people={res.items} loading={first} />
          )}

          {res.items.length > 0 && (
            <div className="load-more">
              <span className="num">Showing {res.items.length.toLocaleString()} of {res.total.toLocaleString()}</span>
              {res.error && <p className="err">Couldn’t load more. Try again.</p>}
              {res.page < res.pages && (
                <button className="btn btn-secondary" onClick={loadMore} disabled={res.loading}>{res.loading ? 'Loading…' : 'Load more'}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
