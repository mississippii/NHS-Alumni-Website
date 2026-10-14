import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { approveJoin, approveStory, deleteIssue, deleteStory, rejectJoin } from '../../api/admin.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Empty } from '../../components/page.jsx';
import { SocialLinks } from '../../components/SocialLinks.jsx';
import { excerpt, shortDate, storyName, studentId } from '../../lib/format.js';
import { SEXES } from '../../lib/school.js';

/** Help requests, join requests and stories visitors sent, each to act on. */
export default function AdminNotifications({ token, joins, setJoins, stories, reloadStories, issues, setIssues }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // id being approved or rejected
  const [error, setError] = useState(null);
  const act = async (fn, id, after) => {
    setBusy(id); setError(null);
    try { await fn(token, id); after(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const dropJoin = id => () => setJoins(l => l.filter(p => p.id !== id));
  return (
    <div className="wrap form admin-page">
      {error && <p className="err" role="alert">{error}</p>}
      {joins.length + stories.length + issues.length === 0 && <div className="card"><Empty icon="verified" title="All done" /></div>}
      {issues.length > 0 && <h2 className="admin-list-title">Help requests ({issues.length})</h2>}
      {issues.map(i => (
        <section key={'i' + i.id} className="card card-pad admin-req">
          <div className="admin-head">
            <Avatar person={{ name: i.name || '?', group: i.group, photo: i.photo }} size="lg" />
            <div>
              <b>{i.name || 'Name not added yet'}</b>
              <span>Student ID {studentId(i.studentId)}{i.batch ? ` · Batch ${i.batch} · ${i.group}` : ''}</span>
            </div>
          </div>
          <p className="prose admin-bio">{i.message}</p>
          <span className="text-2">{i.contact && <>Contact: {i.contact} · </>}sent {shortDate(i.at)}</span>
          <div className="admin-actions">
            <button className="btn btn-primary" type="button" onClick={() => navigate(`/admin?sid=${studentId(i.studentId)}`)}>Fix profile</button>
            <button className="btn btn-secondary" type="button" disabled={busy === 'i' + i.id}
              onClick={() => act((t) => deleteIssue(t, i.id), 'i' + i.id, () => setIssues(l => l.filter(x => x.id !== i.id)))}>Done</button>
          </div>
        </section>
      ))}
      {joins.length > 0 && <h2 className="admin-list-title">Join requests ({joins.length})</h2>}
      {joins.map(p => (
        <section key={p.id} className="card card-pad admin-req">
          <div className="admin-head">
            <Avatar person={p} size="lg" />
            <div>
              <b>{p.name}</b>
              <span>Student ID {studentId(p.id)} · Batch {p.batch} · {p.group}</span>
            </div>
          </div>
          <dl className="facts">
            {[['Village', p.village], ['Email', p.email], ['Phone', p.phone], ['Date of birth', p.birthDate], ['Sex', SEXES[p.sex]], ['Blood group', p.bloodGroup],
              ['Occupation', [p.title, p.org].filter(Boolean).join(' at ')], ['Field', p.industry],
              ['Education', p.education.join(', ')], ['Lives in', [p.city, p.country].filter(Boolean).join(', ')]]
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {p.bio && <p className="prose admin-bio">{p.bio}</p>}
          <SocialLinks links={p.socials} name={p.name} />
          <div className="admin-actions">
            <button className="btn btn-primary" type="button" disabled={busy === p.id} onClick={() => act(approveJoin, p.id, dropJoin(p.id))}>Approve</button>
            <button className="btn btn-secondary" type="button" disabled={busy === p.id}
              onClick={() => window.confirm(`Reject and delete the request from ${p.name}?`) && act(rejectJoin, p.id, dropJoin(p.id))}>Reject</button>
          </div>
        </section>
      ))}
      {stories.length > 0 && <h2 className="admin-list-title">Stories sent ({stories.length})</h2>}
      {stories.map(({ story: s, contact }) => (
        <section key={s.id} className="card card-pad admin-story">
          {s.photo ? <img className="story-thumb" src={s.photo} alt="" /> : <Avatar person={{ name: s.name, group: s.group }} size="lg" />}
          <div>
            <span className="story-tag">sent {s.published}</span>
            <b>{s.title}</b>
            <span className="text-2">{storyName(s)}{s.alumnusId ? ` · Student ID ${studentId(s.alumnusId)}` : ''}{s.batch ? ` · Batch ${s.batch}` : ''}{s.group ? ` · ${s.group}` : ''}{contact ? ` · ${contact}` : ''}</span>
            <p className="admin-bio">{excerpt(s.body, 400)}</p>
            <div className="admin-actions">
              <button className="btn btn-primary btn-sm" type="button" disabled={busy === s.id} onClick={() => act(approveStory, s.id, reloadStories)}>Approve</button>
              {s.alumnusId && <Link className="btn btn-secondary btn-sm" to={`/alumni/${studentId(s.alumnusId)}`}>View profile</Link>}
              <button className="btn btn-ghost btn-sm" type="button" disabled={busy === s.id}
                onClick={() => window.confirm(`Reject “${s.title}”?`) && act(deleteStory, s.id, reloadStories)}>Reject</button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
