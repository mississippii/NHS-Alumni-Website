import { useState } from 'react';
import { Link } from 'react-router-dom';
import { likeComment } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Icon } from '../../components/Icon.jsx';
import { shortDate, studentId } from '../../lib/format.js';

// Comments this browser liked. Kept per device only, so the server never learns who liked what.
const LIKED = 'nhs-liked';
const likedIds = () => { try { return JSON.parse(localStorage.getItem(LIKED)) || []; } catch { return []; } };
const saveLiked = ids => { try { localStorage.setItem(LIKED, JSON.stringify(ids)); } catch { /* storage blocked */ } };

/** One comment, Facebook style: photo, a bubble with "Name ✓ · Batch 2011" and the text (long ones folded), then date · Like. */
function Comment({ c }) {
  const to = `/alumni/${studentId(c.id)}`;
  const long = c.comment.length > 220 || c.comment.split('\n').length > 4;
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(() => likedIds().includes(c.id));
  const [likes, setLikes] = useState(c.likes || 0);
  const toggle = () => {
    const undo = liked;
    setLiked(!undo); setLikes(n => Math.max(0, n + (undo ? -1 : 1)));
    saveLiked(undo ? likedIds().filter(i => i !== c.id) : [...likedIds(), c.id]);
    likeComment(c.id, undo).then(r => setLikes(r.likes)).catch(() => {});
  };
  return (
    <article className="comment">
      <Link to={to} tabIndex={-1} aria-hidden="true"><Avatar person={c} size="sm" /></Link>
      <div className="comment-main">
        <div className="comment-bubble">
          <div className="comment-head">
            <Link className="comment-name" to={to}>{c.name}</Link>
            <Icon name="verified" className="ic comment-tick" />
            <span className="comment-batch">· Batch {c.batch}</span>
          </div>
          <p className={long && !open ? 'clamp' : undefined}>{c.comment}</p>
          {long && <button type="button" className="comment-more" onClick={() => setOpen(!open)}>{open ? 'See less' : 'See more'}</button>}
        </div>
        <div className="comment-foot">
          {c.at && <time dateTime={c.at}>{shortDate(c.at)}</time>}
          <button type="button" className={'comment-like' + (liked ? ' on' : '')} onClick={toggle} aria-pressed={liked}>
            <Icon name="like" />{likes > 0 ? likes : ''} Like
          </button>
        </div>
      </div>
    </article>
  );
}

/** Members' comments, newest first. With `limit`, only the first few and a link to the Events page for the rest. */
export default function Comments({ list, limit }) {
  const shown = limit ? list.slice(0, limit) : list;
  return (
    <div className="comments">
      <h3 className="comments-title">Comments</h3>
      {shown.map(c => <Comment key={c.id} c={c} />)}
      {shown.length < list.length && <Link className="link comments-all" to="/events">See all {list.length} comments<Icon name="arrow" /></Link>}
    </div>
  );
}
