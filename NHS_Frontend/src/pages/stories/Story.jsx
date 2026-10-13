import { Link, useParams } from 'react-router-dom';
import { getStory } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty } from '../../components/page.jsx';
import { storyName, studentId } from '../../lib/format.js';
import { useAsync, useTitle } from '../../lib/hooks.js';
import Article, { person, tag } from './Article.jsx';

/** /stories/:id: one story on its own page (the link to share). */
export default function Story() {
  const id = +useParams().id;
  const { data: s, loading, error } = useAsync(() => getStory(id), [id]);
  useTitle(s ? s.title : loading ? null : 'Story not found');

  if (loading) return <div className="wrap story-skel" aria-busy="true"><div className="skeleton skel-block" /></div>;
  if (error || !s) return (
    <div className="wrap section">
      <div className="card">
        <Empty icon={error ? 'info' : 'search'} title={error ? 'Couldn’t load this story' : 'Story not found'}
          action={<Link className="btn btn-primary" to="/stories">All stories</Link>}>
          {error ? 'Refresh the page to try again.' : 'It may have been removed.'}
        </Empty>
      </div>
    </div>
  );

  return (
    <article className="story">
      <div className="wrap story-wrap story-paper">
        <nav className="breadcrumb story-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><Icon name="chevron" /><Link to="/stories">Stories</Link>
        </nav>
        <Article story={s} full title={<h1 className="story-title">{s.title}</h1>} />
        <aside className="card story-about">
          <Avatar person={person(s)} size="lg" />
          <div>
            <small>{s.kind === 'Batch memory' && !s.alumnusId ? 'Shared by' : 'About'}</small>
            <b>{storyName(s)}</b>
            <span>{[s.role, tag(s)].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="story-foot">
            {s.alumnusId && <Link className="btn btn-primary btn-sm" to={`/alumni/${studentId(s.alumnusId)}`}>View profile</Link>}
            <Link className="btn btn-secondary btn-sm" to="/stories">More stories</Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
