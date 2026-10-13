import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listStories } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { paragraphs } from '../../lib/format.js';
import { useAsync, useTitle } from '../../lib/hooks.js';
import Article, { previewCount } from './Article.jsx';

const SHOWN = 12; // the page shows the most recent stories only
/** One story on the Stories page: the opening paragraph, and "Read the full story" opens the rest right here. */
function StoryItem({ story: s }) {
  const [open, setOpen] = useState(false);
  const all = paragraphs(s.body);
  const longer = previewCount(all) < all.length || !!s.quote;
  return (
    <article className="story-item">
      <Article story={s} full={open} title={<h2 className="story-title"><Link to={`/stories/${s.id}`}>{s.title}</Link></h2>} />
      {longer && (
        <button type="button" className="link story-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : 'Read the full story'}<Icon name="chevron" />
        </button>
      )}
    </article>
  );
}

/** /stories: the most recent stories, newest first, laid out like newspaper articles. */
export default function Stories() {
  useTitle('Stories');
  const { data: list, loading, error } = useAsync(() => listStories(SHOWN), []);
  return (
    <>
      <PageHeader crumbs={[[null, 'Stories']]} title="Alumni stories"
        desc="Success stories and batch memories from the people who once sat in Nimsar High School’s classrooms.">
        <div><Link className="btn btn-primary btn-sm" to="/stories/share">Share a story</Link></div>
      </PageHeader>
      <section className="section stories-page">
        <div className="wrap story-paper">
          {loading ? <div className="skeleton skel-block" aria-busy="true" />
            : error || !list.length ? (
              <div className="card">
                <Empty icon="book" title={error ? 'Couldn’t load stories' : 'Stories are coming soon'}
                  action={<Link className="btn btn-primary" to="/alumni">Browse alumni</Link>}>
                  {error ? 'Refresh the page to try again.' : 'Journeys, memories and achievements from former students of the school.'}
                </Empty>
              </div>
            ) : list.map(s => <StoryItem key={s.id} story={s} />)}
        </div>
      </section>
    </>
  );
}
