import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBatches } from '../../api/public.js';
import { BatchCard } from '../../components/batches.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { useAsync, useTitle } from '../../lib/hooks.js';
import { BLOOD_GROUPS } from '../../lib/school.js';

export default function Batches() {
  useTitle('Alumni');
  const { data, error } = useAsync(listBatches, []);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const all = [...(data || [])].reverse();
  const shown = all.filter(b => String(b.year).includes(q.trim()));
  const years = all.map(b => b.year);

  return (
    <>
      <PageHeader crumbs={[[null, 'Alumni']]} title="Alumni">
        <div className="batch-search search-by">
          <label className="input-icon" htmlFor="by">
            <Icon name="search" />
            <input id="by" className="input" type="search" inputMode="numeric" enterKeyHint="search" value={q}
              onChange={e => setQ(e.target.value)} placeholder="Batch" autoComplete="off" />
          </label>
          <button className="btn btn-secondary filter-btn" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Filter by blood group">
            <Icon name="filter" />
          </button>
        </div>
      </PageHeader>

      {/* the same sheet as a batch page's Filter; a blood group opens everyone with it, from every batch */}
      {open && <>
        <div className="scrim" onClick={() => setOpen(false)} />
        <div className="filters" role="dialog" aria-modal="true" aria-labelledby="filters-title">
          <div className="sheet-head">
            <h2 id="filters-title">Filter</h2>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" /></button>
          </div>
          <div className="sheet-body">
            <fieldset>
              <legend>Blood group</legend>
              <div className="blood-grid">
                {BLOOD_GROUPS.map(b => (
                  <button key={b} type="button" className="btn btn-secondary" onClick={() => navigate(`/directory?blood=${encodeURIComponent(b)}`)}>{b}</button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </>}

      <section className="section batches-page">
        <div className="wrap">
          {error && <div className="card"><Empty icon="info" title="Couldn’t load batches">Refresh the page to try again.</Empty></div>}
          {!data && !error && <div className="batch-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton batch-skel" />)}</div>}
          {data && !shown.length && <div className="card"><Empty icon="search" title={`No batch matches “${q.trim()}”`}>Try a year between {Math.min(...years)} and {Math.max(...years)}.</Empty></div>}
          <div className="batch-grid">{shown.map(b => <BatchCard key={b.year} batch={b} detail />)}</div>
        </div>
      </section>
    </>
  );
}
