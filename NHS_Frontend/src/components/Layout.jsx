import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SCHOOL, THIS_YEAR } from '../lib/school.js';
import { Icon } from './Icon.jsx';

// Shared by the desktop nav and the phone tab bar.
const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/alumni', label: 'Alumni', icon: 'users' },
  { to: '/stories', label: 'Stories', icon: 'book' },
  { to: '/events', label: 'Events', icon: 'calendar' },
];
// On /admin the same nav and tab bar switch to the admin sections.
const ADMIN_NAV = [
  { to: '/admin', label: 'Home', icon: 'home' },
  { to: '/admin/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/admin/events', label: 'Events', icon: 'calendar' },
  { to: '/admin/stories', label: 'Stories', icon: 'book' },
];

function Crest({ className = 'crest' }) {
  return (
    <svg className={className} viewBox="0 0 34 38" aria-hidden="true">
      <path d="M17 1 32 6v12c0 9-6.5 15.5-15 19C8.5 33.5 2 27 2 18V6z" fill="var(--brand)" />
      <path d="M17 5 28 8.7V18c0 6.8-4.6 11.8-11 14.8C10.6 29.8 6 24.8 6 18V8.7z" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
      <text x="17" y="21.5" textAnchor="middle" fontFamily="Young Serif, Georgia, serif" fontSize="9" fill="var(--brand-fg)">{SCHOOL.short}</text>
    </svg>
  );
}

/** Red count on the admin Notifications link: join requests + stories waiting. */
const Count = ({ n, bar }) => (n.to === '/admin/notifications' && bar?.waiting > 0
  ? <b className="nav-count" aria-label={`${bar.waiting} waiting`}>{bar.waiting > 99 ? '99+' : bar.waiting}</b> : null);

export default function Layout() {
  const { pathname, hash } = useLocation();
  const [adminBar, setAdminBar] = useState(null); // { waiting, logout } while an admin is logged in on /admin
  const isCurrent = to =>
    to === '/' || to === '/admin' ? pathname === to && !hash : pathname.startsWith(to) || (to === '/alumni' && pathname.startsWith('/directory'));

  // Scroll to the hash target (old /#events links), or to the top, on every navigation.
  useEffect(() => {
    const el = hash && document.getElementById(hash.slice(1));
    el ? el.scrollIntoView() : window.scrollTo(0, 0);
  }, [pathname, hash]);

  const current = to => (isCurrent(to) ? 'page' : undefined);
  const isAdmin = pathname.startsWith('/admin');
  const nav = isAdmin ? ADMIN_NAV : NAV;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <div className="wrap">
          <Link className="brand" to="/" aria-label={`${SCHOOL.name} Alumni, home`}>
            <Crest />
            <span className="brand-name"><b>{SCHOOL.name}</b><small>{isAdmin ? 'Admin' : 'Alumni Network'}</small></span>
          </Link>
          <nav className="nav" aria-label="Main">
            {nav.map(n => <Link key={n.to} to={n.to} aria-current={current(n.to)}>{n.label}<Count n={n} bar={adminBar} /></Link>)}
            {isAdmin ? <Link to="/">View site</Link> : <Link to="/about" aria-current={current('/about')}>About</Link>}
          </nav>
          {isAdmin && adminBar && <button className="btn btn-secondary btn-sm header-logout" type="button" onClick={adminBar.logout}>Log out</button>}
        </div>
      </header>

      {/* pages load on first visit (see main.jsx); the header and tab bar stay put meanwhile */}
      <main id="main" tabIndex={-1}><Suspense fallback={null}><Outlet context={setAdminBar} /></Suspense></main>

      {!isAdmin && (
      <footer className="footer">
        <div className="wrap">
          <div className="footer-top">
            <p className="footer-tag">Once a student, always family.</p>
            <div className="footer-brand">
              <Crest />
              <div><b>{SCHOOL.name}</b><p>{SCHOOL.city} · Est. {SCHOOL.est} · EIIN: {SCHOOL.eiin}</p>
                <p>Contact: <a className="footer-mail" href={`mailto:${SCHOOL.email}`}>{SCHOOL.email}</a></p></div>
            </div>
          </div>
          <nav aria-label="Footer">
            <Link to="/alumni">Alumni</Link>
            <Link to="/stories">Stories</Link>
            <Link to="/events">Events</Link>
            <Link to="/about">About</Link>
          </nav>
          <p className="footer-bottom">© {THIS_YEAR} {SCHOOL.name} Alumni Association</p>
        </div>
      </footer>
      )}

      <nav className="tabbar" aria-label="Main">
        {nav.map(n => (
          <Link key={n.to} to={n.to} aria-current={current(n.to)}><span className="tab-ic"><Icon name={n.icon} /><Count n={n} bar={adminBar} /></span>{n.label}</Link>
        ))}
      </nav>
    </>
  );
}
