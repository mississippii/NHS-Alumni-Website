import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteReply } from '../../api/admin.js';
import { addReply, likeComment } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Icon } from '../../components/Icon.jsx';
import { shortDate, studentId } from '../../lib/format.js';
import StudentIdDialog from './StudentIdDialog.jsx';

// Comments this browser liked. Kept per device only, so the server never learns who liked what.
const LIKED = 'nhs-liked';
const likedIds = () => { try { return JSON.parse(localStorage.getItem(LIKED)) || []; } catch { return []; } };
const saveLiked = ids => { try { localStorage.setItem(LIKED, JSON.stringify(ids)); } catch { /* storage blocked */ } };
// Who replies from this phone ({ id, name }), asked once in a popup. The admin's token shows Delete on replies.
const ME = 'nhs-replier';
const getMe = () => { try { return JSON.parse(localStorage.getItem(ME)); } catch { return null; } };
const setMe = me => { try { me ? localStorage.setItem(ME, JSON.stringify(me)) : localStorage.removeItem(ME); } catch { /* storage blocked */ } };
const adminToken = () => { try { return sessionStorage.getItem('nhs-admin-token'); } catch { return null; } };

/** Reply form: "Replying as Name · Not you?" + the text. */
function ReplyBox({ commentId, to, me, onSent, onCancel, onNotMe }) {
  const [text, setText] = useState(to.parentId ? `@${to.name} ` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      onSent(await addReply(commentId, me.id, text, to.parentId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="reply-box" onSubmit={send}>
      <p className="reply-as">Replying as <b>{me.name}</b> · <button type="button" className="comment-more" onClick={onNotMe}>Not you?</button></p>
      <textarea className="input textarea" required autoFocus rows="2" maxLength={1000} placeholder={`Reply to ${to.name}…`}
        aria-label={`Reply to ${to.name}`} value={text} onChange={e => setText(e.target.value)} />
      {error && <p className="err" role="alert">{error}</p>}
      <div className="reply-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Reply'}</button>
      </div>
    </form>
  );
}

/** One reply: small photo + bubble linked to the student's profile, then date · Reply (· Delete for the admin). */
function ReplyRow({ r, onReply, onDelete, children }) {
  const to = `/alumni/${studentId(r.authorId)}`;
  return (
    <article className="comment reply">
      <Link to={to} tabIndex={-1} aria-hidden="true"><Avatar person={r} size="xs" /></Link>
      <div className="comment-main">
        <div className="comment-bubble">
          <div className="comment-head">
            <Link className="comment-name" to={to}>{r.name}</Link>
            <span className="comment-batch">· Batch {r.batch}</span>
          </div>
          <p>{r.text}</p>
        </div>
        <div className="comment-foot">
          {r.at && <time dateTime={r.at}>{shortDate(r.at)}</time>}
          <button type="button" className="comment-like" onClick={onReply}>Reply</button>
          {onDelete && <button type="button" className="comment-like" onClick={onDelete}>Delete</button>}
        </div>
        {children}
      </div>
    </article>
  );
}

/** Replies under a comment, two levels like Facebook. Long threads start folded behind "View N replies". */
function Replies({ c, replyTo, setReplyTo, startReply, me, notMe }) {
  const [list, setList] = useState(c.replies || []);
  const [open, setOpen] = useState(list.length <= 2);
  const token = adminToken();
  const box = parentId => replyTo && me && replyTo.parentId === parentId &&
    <ReplyBox commentId={c.id} to={replyTo} me={me} onCancel={() => setReplyTo(null)} onNotMe={notMe}
      onSent={r => { setList(l => [...l, r]); setOpen(true); setReplyTo(null); }} />;
  const remove = async r => {
    if (!confirm('Delete this reply and the replies under it?')) return;
    try { await deleteReply(token, r.id); setList(l => l.filter(x => x.id !== r.id && x.parentId !== r.id)); } catch (err) { alert(err.message); }
  };
  const row = (r, kids) => <ReplyRow r={r} onReply={() => startReply({ parentId: r.parentId ?? r.id, name: r.name })}
    onDelete={token ? () => remove(r) : null}>{kids}</ReplyRow>;
  // Each <li> draws its curved line from the parent's photo (CSS .replies > li::before); the reply form gets none.
  const branch = (items, parentId) => {
    const b = box(parentId);
    return (items.length > 0 || b) && (
      <ul className="replies">
        {items}
        {b && <li className="no-line">{b}</li>}
      </ul>
    );
  };
  const top = list.filter(r => !r.parentId);

  if (!list.length && !replyTo) return null;
  return branch(!open
    ? [<li key="more"><button type="button" className="comment-more" onClick={() => setOpen(true)}>View {list.length} replies</button></li>]
    : top.map(t => <li key={t.id}>{row(t, branch(list.filter(r => r.parentId === t.id).map(r => <li key={r.id}>{row(r)}</li>), t.id))}</li>),
  undefined);
}

/** One comment, Facebook style: photo, a bubble with "Name ✓ · Batch 2011" and the text (long ones folded), then date · Like. */
function Comment({ c }) {
  const to = `/alumni/${studentId(c.id)}`;
  const long = c.comment.length > 220 || c.comment.split('\n').length > 4;
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(() => likedIds().includes(c.id));
  const [likes, setLikes] = useState(c.likes || 0);
  const [replyTo, setReplyTo] = useState(null); // { parentId, name } while the reply form is open
  const [asking, setAsking] = useState(null);   // the reply waiting for the Student ID popup
  const me = getMe(); // read each render: another comment's popup may have just saved it
  const startReply = to => (getMe() ? setReplyTo(to) : setAsking(to));
  const notMe = () => { setMe(null); setAsking(replyTo); setReplyTo(null); };
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
          <button type="button" className="comment-like" onClick={() => startReply({ name: c.name })}>Reply</button>
        </div>
        <Replies c={c} replyTo={replyTo} setReplyTo={setReplyTo} startReply={startReply} me={me} notMe={notMe} />
        {asking && <StudentIdDialog onClose={() => setAsking(null)}
          onDone={m => { setMe(m); setReplyTo(asking); setAsking(null); }} />}
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
