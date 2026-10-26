import { getStats, listAlumni, listBatches, listComments, listEvents } from '../../api/public.js';
import { BatchCard } from '../../components/batches.jsx';
import { Carousel } from '../../components/Carousel.jsx';
import { SectionHead } from '../../components/page.jsx';
import { ProfileCard } from '../../components/people.jsx';
import { useAsync, useTitle } from '../../lib/hooks.js';
import { SCHOOL } from '../../lib/school.js';
import Comments from '../events/Comments.jsx';
import EventList from '../events/EventList.jsx';
import HeroSearch from './HeroSearch.jsx';
import Marquee from './Marquee.jsx';
import JoinFinder from './JoinFinder.jsx';

export default function Home() {
  useTitle(null);
  const batches = useAsync(listBatches, []);
  const stats = useAsync(getStats, []);
  const joined = useAsync(() => listAlumni({ joined: true, sort: 'joined', size: 10 }), []);
  const events = useAsync(listEvents, []);
  const comments = useAsync(listComments, []);
  const s = stats.data;

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true"><img className="hero-photo" src="/school.jpg" alt="" /></div>
        <div className="wrap">
          <p className="hero-eyebrow">{SCHOOL.name} · EIIN: {SCHOOL.eiin}</p>
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

      <JoinFinder firstRecord={s?.firstRecordBatch} />

      <section className="section">
        <div className="wrap">
          <SectionHead title="Find your batch" desc="Your batch is the year you first sat the SSC exam." to="/alumni" linkLabel="All batches" />
          {batches.data ? <Marquee items={[...batches.data].reverse()} secs={3.5} render={b => <BatchCard key={b.year} batch={b} />} /> : (
            <div className="batch-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton batch-skel" />)}</div>
          )}
        </div>
      </section>

      {joined.data?.items.length > 0 && (
        <section className="section">
          <div className="wrap">
            <SectionHead title="Recently joined" to="/directory?joined=true&sort=joined" />
            <Carousel arrows={joined.data.items.length > 4}>{joined.data.items.map(p => <ProfileCard key={p.id} person={p} />)}</Carousel>
          </div>
        </section>
      )}

      <section className="section" id="events">
        <div className="wrap">
          <SectionHead title="Upcoming events" to="/events" linkLabel="All" />
          <EventList list={events.data} />
          {comments.data?.length > 0 && <Comments list={comments.data} limit={3} />}
        </div>
      </section>

    </>
  );
}
