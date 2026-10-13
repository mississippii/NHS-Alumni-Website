import { useState } from 'react';
import { listBatches } from '../../api/public.js';
import { BatchCard } from '../../components/batches.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { useAsync, useTitle } from '../../lib/hooks.js';

export default function Batches() {
  useTitle('Alumni');
  const { data, error } = useAsync(listBatches, []);
  const [q, setQ] = useState('');
  const all = [...(data || [])].reverse();
  const shown = all.filter(b => String(b.year).includes(q.trim()));
  const years = all.map(b => b.year);
  const largest = all.reduce((m, b) => (b.count > m.count ? b : m), all[0]);

  return (
    <>
      <PageHeader crumbs={[[null, 'Alumni']]} title="Alumni">
        <label className="input-icon batch-search" htmlFor="by">
          <Icon name="search" />
          <input id="by" className="input" type="search" inputMode="numeric" enterKeyHint="search" value={q}
            onChange={e => setQ(e.target.value)} placeholder="Search by batch, e.g. 2014" autoComplete="off" />
        </label>
      </PageHeader>

      <section className="section batches-page">
        <div className="wrap">
          {error && <div className="card"><Empty icon="info" title="Couldn’t load batches">Refresh the page to try again.</Empty></div>}
          {!data && !error && <div className="batch-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton batch-skel" />)}</div>}
          {data && !shown.length && <div className="card"><Empty icon="search" title={`No batch matches “${q.trim()}”`}>Try a year between {Math.min(...years)} and {Math.max(...years)}.</Empty></div>}
          <div className="batch-grid">{shown.map(b => <BatchCard key={b.year} batch={b} detail top={b === largest} />)}</div>
        </div>
      </section>
    </>
  );
}
