import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listAlumni, listBatches, listCountries } from '../api.js';
import { BatchSummary, BLOOD_GROUPS, Empty, GROUPS, Icon, PageHeader, PeopleList, StudentGrid, useAsync, useTitle } from '../components/ui.jsx';

const SORTS = [['id', 'Default order'], ['name', 'Name A–Z'], ['name-desc', 'Name Z–A'], ['newest', 'Newest batch'], ['oldest', 'Oldest batch']];

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
  const countries = useAsync(listCountries, []);
  const [q, setQ] = useState(f.q);
  const [sheet, setSheet] = useState(false);
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

  // Keep the selected year visible in the phone strip. Scroll only the strip: scrollIntoView would also shift the page sideways.
  useEffect(() => {
    const strip = document.querySelector('.filter-strip'), on = strip?.querySelector('.year-chip[aria-pressed="true"]');
    if (on) strip.scrollTo({ left: on.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2 });
  }, [f.batch, batches.data]);

  // Lock page scroll behind the open sheet; Escape closes it.
  useEffect(() => {
    if (!sheet) return;
    document.body.style.overflow = 'hidden';
    const esc = e => e.key === 'Escape' && setSheet(false);
    addEventListener('keydown', esc);
    return () => { document.body.style.overflow = ''; removeEventListener('keydown', esc); };
  }, [sheet]);

  const years = [...(batches.data || [])].reverse();
  const batchInfo = f.batch ? years.find(b => b.year === f.batch) : null;
  const pickBatch = y => setOne('batch', f.batch === y ? '' : y);
  const chips = [
    f.q && ['q', null, `“${f.q}”`],
    f.batch && ['batch', null, `Batch ${f.batch}`],
    ...f.groups.map(g => ['group', g, g]),
    ...f.industries.map(g => ['field', g, g]),
    ...f.blood.map(b => ['blood', b, `Blood ${b}`]),
    f.country && ['country', null, f.country],
    f.joined && ['joined', null, 'Joined only'],
  ].filter(Boolean);
  const filterCount = chips.filter(c => c[0] !== 'q').length;
  const clearAll = () => { setQ(''); setSp(new URLSearchParams(f.sort !== 'id' ? { sort: f.sort } : {}), { replace: true }); };
  const removeChip = (k, v) => (v ? toggle(k, v) : k === 'q' ? (setQ(''), setOne('q', '')) : setOne(k, ''));
  const first = res.loading && !res.items.length;
  const fields = Object.keys(res.facets?.industry || {});

  const check = (k, v, label, n, dot) => (
    <label key={v} className={`check${n || (k === 'group' ? f.groups : f.industries).includes(v) ? '' : ' zero'}`}>
      <input type="checkbox" checked={(k === 'group' ? f.groups : f.industries).includes(v)} onChange={() => toggle(k, v)} />
      {dot && <i className={`dot ${dot}`} aria-hidden="true" />}
      {label}<span className="n num">{n ?? ''}</span>
    </label>
  );

  return (
    <>
      {batchInfo ? (
        <PageHeader crumbs={[['/batches', 'Batches'], [null, `Batch ${f.batch}`]]} title={`Batch ${f.batch}`}
          desc={`${batchInfo.count.toLocaleString()} alumni who first sat SSC in ${f.batch}.`}>
          <BatchSummary batch={batchInfo} />
        </PageHeader>
      ) : (
        <PageHeader crumbs={[[null, 'Alumni']]} title="Alumni directory"
          desc={f.batch ? `Everyone who first sat SSC in ${f.batch}.` : 'Search and filter every former student by batch, group and more.'} />
      )}

      <div className="wrap dir">
        {sheet && <div className="scrim" onClick={() => setSheet(false)} />}
        <aside className={`filters${sheet ? ' open' : ''}`} aria-label="Filters" role={sheet ? 'dialog' : undefined} aria-modal={sheet || undefined}>
          <div className="sheet-head">
            <h2>Filters</h2>
            <button className="btn btn-ghost btn-sm" type="button" onClick={clearAll}>Reset</button>
          </div>
          <div className="sheet-body">
            <fieldset>
              <legend><label htmlFor="f-batch">Batch</label></legend>
              <select id="f-batch" className="select" value={f.batch || ''} onChange={e => setOne('batch', e.target.value)}>
                <option value="">All batches · {years.reduce((s, b) => s + b.count, 0).toLocaleString()}</option>
                {years.map(b => <option key={b.year} value={b.year}>{b.year} · {b.count} students</option>)}
              </select>
            </fieldset>
            <fieldset className="mob-only">
              <legend><label htmlFor="sort-m">Sort by</label></legend>
              <select id="sort-m" className="select" value={f.sort} onChange={e => setOne('sort', e.target.value === 'id' ? '' : e.target.value)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </fieldset>
            <fieldset>
              <legend>Blood group</legend>
              <div className="blood-pills">
                {BLOOD_GROUPS.map(b => {
                  const n = res.facets?.blood?.[b] ?? 0;
                  return (
                    <button key={b} type="button" className={`blood-pill${n ? '' : ' zero'}`} aria-pressed={f.blood.includes(b)} onClick={() => toggle('blood', b)}
                      aria-label={`${b}, ${n} ${n === 1 ? 'person' : 'people'}`}>
                      {b}{n > 0 && <small className="num">{n}</small>}
                    </button>
                  );
                })}
              </div>
              <small className="hint">Only alumni who joined and shared it.</small>
            </fieldset>
            <fieldset>
              <legend>Group</legend>
              {GROUPS.map(g => check('group', g.name, g.name, res.facets?.group?.[g.name] ?? 0, g.cls))}
            </fieldset>
            {(fields.length > 0 || f.industries.length > 0) && (
              <fieldset>
                <legend>Field</legend>
                {[...new Set([...fields, ...f.industries])].map(v => check('field', v, v, res.facets?.industry?.[v] ?? 0))}
              </fieldset>
            )}
            {countries.data?.length > 0 && (
              <fieldset>
                <legend><label htmlFor="f-country">Lives in</label></legend>
                <select id="f-country" className="select" value={f.country} onChange={e => setOne('country', e.target.value)}>
                  <option value="">Anywhere</option>
                  {countries.data.map(c => <option key={c}>{c}</option>)}
                </select>
              </fieldset>
            )}
            <label className="switch-row">
              <span><b>Joined alumni only</b><small>People who have added their details</small></span>
              <input type="checkbox" role="switch" className="switch" checked={f.joined} onChange={() => setOne('joined', f.joined ? '' : 'true')} />
            </label>
            <button className="btn btn-secondary desk-only" type="button" onClick={clearAll} disabled={!filterCount}>Clear filters</button>
          </div>
          <div className="sheet-foot">
            <button className="btn btn-primary btn-block" type="button" onClick={() => setSheet(false)}>
              {res.loading ? 'Updating…' : `Show ${res.total.toLocaleString()} ${res.total === 1 ? 'result' : 'results'}`}
            </button>
          </div>
        </aside>

        <div>
          <div className="toolbar">
            <label className="input-icon" htmlFor="q">
              <Icon name="search" />
              <input id="q" className="input" type="search" enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Name, SSC roll or company" autoComplete="off" />
            </label>
            <div className="filter-strip" role="toolbar" aria-label="Filters and sorting">
              <span className="strip-pin">
                <button className="chip filter-btn" type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-pressed={filterCount > (f.batch ? 1 : 0)}>
                  <Icon name="filter" />Filters{filterCount - (f.batch ? 1 : 0) > 0 && <b>{filterCount - (f.batch ? 1 : 0)}</b>}
                </button>
              </span>
              <label className="sr-only" htmlFor="sort">Sort by</label>
              <select id="sort" className="select sort-select" value={f.sort} onChange={e => setOne('sort', e.target.value === 'id' ? '' : e.target.value)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {years.length > 0 && <>
                <span className="strip-sep" aria-hidden="true" />
                <button type="button" className="chip year-chip" aria-pressed={!f.batch} onClick={() => setOne('batch', '')}>All</button>
                {years.map(b => (
                  <button key={b.year} type="button" className="chip year-chip num" aria-pressed={f.batch === b.year} onClick={() => pickBatch(b.year)}>{b.year}</button>
                ))}
              </>}
            </div>
          </div>

          <div className="results-bar" aria-live="polite">
            <span className="count num">{first ? 'Loading…' : res.error && !res.items.length ? '' : `${res.total.toLocaleString()} ${res.total === 1 ? 'result' : 'results'}`}</span>
            {chips.map(([k, v, label]) => (
              <button key={k + v} type="button" className={`chip chip-removable${k === 'batch' ? ' desk-chip' : ''}`} onClick={() => removeChip(k, v)} aria-label={`Remove filter ${label}`}>
                {label}<Icon name="x" />
              </button>
            ))}
            {chips.filter(c => c[0] !== 'batch').length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all</button>}
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
