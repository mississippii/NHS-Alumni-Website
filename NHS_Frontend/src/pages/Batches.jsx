import { listBatches } from '../api.js';
import { BatchCard, Empty, GroupLegend, PageHeader, useAsync, useTitle } from '../components/ui.jsx';

export default function Batches() {
  useTitle('Batches');
  const { data, error } = useAsync(listBatches, []);
  const byDecade = new Map();
  for (const b of [...(data || [])].reverse()) {
    const d = Math.floor(b.year / 10) * 10;
    byDecade.set(d, [...(byDecade.get(d) || []), b]);
  }
  const years = data?.map(b => b.year) || [];

  return (
    <>
      <PageHeader crumbs={[[null, 'Batches']]} title="Batches"
        desc={years.length ? `${years.length} batches, from ${Math.min(...years)} to ${Math.max(...years)}. A batch is the year its students first sat SSC.` : null} />

      <section className="section">
        <div className="wrap">
          {error && <div className="card"><Empty icon="info" title="Couldn’t load batches">Refresh the page to try again.</Empty></div>}
          {data && (
            <div className="batches-top">
              <GroupLegend />
            </div>
          )}
          {!data && !error && <div className="batch-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton batch-skel" />)}</div>}
          {[...byDecade].map(([d, ys]) => (
            <div key={d} className="decade">
              <div className="decade-head">
                <h2>{d}s</h2>
                <span className="num">{ys.reduce((s, b) => s + b.count, 0).toLocaleString()} alumni</span>
              </div>
              <div className="batch-grid">{ys.map(b => <BatchCard key={b.year} batch={b} />)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
