// How a story is laid out, shared by the Stories list and a story's own page.
import { Avatar } from '../../components/Avatar.jsx';
import { initials, paragraphs, storyName } from '../../lib/format.js';

const when = d => new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
/** "Batch 2013 · Science", "Batch 2005", or nothing. */
export const tag = s => [s.batch && `Batch ${s.batch}`, s.group].filter(Boolean).join(' · ') || null;
export const person = s => ({ name: s.name, photo: s.photo, group: s.group });

/** Every story picture sits in the same 4:3 frame. No photo: the school under green, with the person's initials. */
function Cover({ story: s }) {
  return (
    <div className="story-cover">
      {s.photo ? <img src={s.photo} alt="" loading="lazy" />
        : <div className="story-art" aria-hidden="true"><span>{initials(s.name)}</span></div>}
    </div>
  );
}

function Byline({ story: s }) {
  return (
    <div className="story-by">
      <Avatar person={person(s)} size="sm" />
      <span><b>{storyName(s)}</b>{s.role && <small>{s.role}</small>}</span>
    </div>
  );
}

const PREVIEW = 450; // characters of the opening paragraphs shown before "Read the full story"
/** How many paragraphs the folded story shows: at least one, then more while under PREVIEW characters. */
export const previewCount = list => {
  let n = 1, len = list[0]?.length || 0;
  while (n < list.length && len + list[n].length <= PREVIEW) len += list[n++].length;
  return n;
};

/** Headline, byline, then the text in newspaper columns with a small photo in the right column. */
export default function Article({ story: s, full, title }) {
  const all = paragraphs(s.body);
  const [lead, ...more] = full ? all : all.slice(0, previewCount(all));
  return (
    <>
      <span className="story-chip">{s.kind}</span>
      {title}
      <div className="story-meta">
        <Byline story={s} />
        <span>{[tag(s), when(s.published)].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="story-cols">
        <figure className="story-photo">
          <Cover story={s} />
          <figcaption><b>{storyName(s)}</b>{s.role && <span>{s.role}</span>}</figcaption>
        </figure>
        <div className="story-body">
          {lead && <p className="story-lead">{lead}</p>}
          {full && s.quote && <blockquote className="story-quote"><p>{s.quote}</p><cite>{storyName(s)}</cite></blockquote>}
          {more.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>
    </>
  );
}
