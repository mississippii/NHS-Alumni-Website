import { useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { adminLogin, adminLogout, listAllStories, listIssues, listPending } from '../../api/admin.js';
import { PageHeader } from '../../components/page.jsx';
import { useTitle } from '../../lib/hooks.js';
import AdminEvents from './AdminEvents.jsx';
import AdminNotifications from './AdminNotifications.jsx';
import AdminStories from './AdminStories.jsx';
import AdminStudents from './AdminStudents.jsx';

// The login token lives for this browser tab only (and 12 hours on the server); closing the tab logs the admin out.
const KEY = 'nhs-admin-token';
const load = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const save = t => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } };

/** Admin panel at /admin (not linked from the site): Home (edit any student), Notifications, Events, Stories. */
export default function Admin() {
  useTitle('Admin');
  const section = useLocation().pathname.split('/')[2] || 'home';
  const [token, setToken] = useState(load);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [joins, setJoins] = useState(null);     // join requests waiting; also proves the token works
  const [storyList, setStoryList] = useState(null);
  const [issues, setIssues] = useState([]);    // help notes sent from profiles
  const [error, setError] = useState(null);
  const setAdminBar = useOutletContext(); // the site header shows Log out and the waiting count

  const expired = e => { setJoins(null); setError(e.status === 401 ? 'Your login has expired. Please log in again.' : e.message); if (e.status === 401) { setToken(''); save(''); } };
  const reloadStories = (t = token) => { listIssues(t).then(setIssues, () => {}); return listAllStories(t).then(setStoryList, expired); };
  const open = t => listPending(t).then(l => { setToken(t); save(t); setJoins(l); setError(null); reloadStories(t); }, expired);
  useEffect(() => { if (token) open(token); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // New join requests and stories show up without a reload.
  // ponytail: polls every minute; push (SSE) if admins need it instantly.
  useEffect(() => {
    if (!token || !joins) return;
    const t = setInterval(() => { listPending(token).then(setJoins, expired); reloadStories(); }, 60_000);
    return () => clearInterval(t);
  }, [token, !joins]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = e => {
    e.preventDefault();
    setError(null);
    adminLogin(email.trim(), password).then(t => { setPassword(''); open(t); }, err => setError(err.message));
  };
  const logout = () => { adminLogout(token).catch(() => {}); setToken(''); save(''); setJoins(null); };

  const waiting = joins ? joins.length + issues.length + (storyList || []).filter(i => i.status === 'PENDING').length : 0;
  useEffect(() => {
    setAdminBar(token && joins ? { waiting, logout } : null);
    return () => setAdminBar(null);
  }, [token, !joins, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token || !joins) return (
    <>
      <PageHeader title="Admin login" />
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

  const pendingStories = (storyList || []).filter(i => i.status === 'PENDING');

  if (section === 'notifications') return <AdminNotifications token={token} joins={joins} setJoins={setJoins} stories={pendingStories} reloadStories={reloadStories} issues={issues} setIssues={setIssues} />;
  if (section === 'events') return <AdminEvents token={token} />;
  if (section === 'stories') return <AdminStories token={token} list={storyList && storyList.filter(i => i.status !== 'PENDING')} reload={reloadStories} />;
  return <AdminStudents token={token} />;
}
