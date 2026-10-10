import { useEffect, useState } from 'react';
import { adminLogin, adminLogout, approveJoin, listPending, rejectJoin, studentId } from '../api.js';
import { Avatar, Empty, PageHeader, SocialLinks, useTitle } from '../components/ui.jsx';

// The login token lives for this browser tab only (and 12 hours on the server); closing the tab logs the admin out.
const KEY = 'nhs-admin-token';
const load = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const save = t => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

/** Admin: approve or reject join requests (batches older than the school's sheets). Reached at /admin, not linked. */
export default function Admin() {
  useTitle('Admin');
  const [token, setToken] = useState(load);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // id being approved or rejected

  const open = t => listPending(t).then(
    l => { setToken(t); save(t); setList(l); setError(null); },
    e => { setList(null); setError(e.status === 401 ? 'Your login has expired. Please log in again.' : e.message); if (e.status === 401) { setToken(''); save(''); } });
  useEffect(() => { if (token) open(token); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, id) => {
    setBusy(id); setError(null);
    try { await fn(token, id); setList(l => l.filter(p => p.id !== id)); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };
  const reject = p => window.confirm(`Reject and delete the request from ${p.name}?`) && act(rejectJoin, p.id);
  const login = e => {
    e.preventDefault();
    setError(null);
    adminLogin(email.trim(), password).then(t => { setPassword(''); open(t); }, err => setError(err.message));
  };
  const logout = () => { adminLogout(token).catch(() => {}); setToken(''); save(''); setList(null); };

  if (!token || !list) return (
    <>
      <PageHeader title="Admin login" desc="Log in to review join requests." />
      <form className="wrap form" onSubmit={login}>
        <section className="card card-pad form-card form-one">
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit">Log in</button>
        </section>
      </form>
    </>
  );

  return (
    <>
      <PageHeader title="Join requests" desc={`${list.length} waiting for approval. Approved profiles go live at once; rejected ones are deleted.`}>
        <div><button className="btn btn-secondary btn-sm" type="button" onClick={logout}>Log out</button></div>
      </PageHeader>
      <div className="wrap form">
        {error && <p className="err" role="alert">{error}</p>}
        {list.length === 0 && <div className="card"><Empty icon="verified" title="All done">No join requests are waiting.</Empty></div>}
        {list.map(p => (
          <section key={p.id} className="card card-pad admin-req">
            <div className="admin-head">
              <Avatar person={p} size="lg" />
              <div>
                <b>{p.name}</b>
                <span>Student ID {studentId(p.id)} · Batch {p.batch} · {p.group}</span>
              </div>
            </div>
            <dl className="facts">
              {[['Village', p.village], ['Email', p.email], ['Phone', p.phone], ['Blood group', p.bloodGroup],
                ['Occupation', [p.title, p.org].filter(Boolean).join(' at ')], ['Field', p.industry],
                ['Education', p.education.join(', ')], ['Lives in', [p.city, p.country].filter(Boolean).join(', ')]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {p.bio && <p className="prose admin-bio">{p.bio}</p>}
            <SocialLinks links={p.socials} name={p.name} />
            <div className="admin-actions">
              <button className="btn btn-primary" type="button" disabled={busy === p.id} onClick={() => act(approveJoin, p.id)}>Approve</button>
              <button className="btn btn-secondary" type="button" disabled={busy === p.id} onClick={() => reject(p)}>Reject</button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
