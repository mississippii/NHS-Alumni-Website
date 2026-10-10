import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SCHOOL, THIS_YEAR } from '../api.js';
import { Icon } from './ui.jsx';

// Shared by the desktop nav and the phone tab bar.
const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/directory', label: 'Alumni', icon: 'users' },
  { to: '/batches', label: 'Batches', icon: 'layers' },
  { to: '/#events', label: 'Events', icon: 'calendar' },
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

export default function Layout() {
  const { pathname, hash } = useLocation();
  const [toast, setToast] = useState(null);
  const here = pathname + hash;
  const isCurrent = to =>
    to === '/' ? here === '/' : to.includes('#') ? here === to : pathname.startsWith(to) || (to === '/directory' && pathname.startsWith('/alumni'));

  // Scroll to the hash target, or to the top, on every navigation.
  useEffect(() => {
    const el = hash && document.getElementById(hash.slice(1));
    el ? el.scrollIntoView() : window.scrollTo(0, 0);
  }, [pathname, hash]);

  useEffect(() => {
    let t;
    const on = e => { setToast(e.detail); clearTimeout(t); t = setTimeout(() => setToast(null), 2600); };
    window.addEventListener('toast', on);
    return () => { window.removeEventListener('toast', on); clearTimeout(t); };
  }, []);

  const current = to => (isCurrent(to) ? 'page' : undefined);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <div className="wrap">
          <Link className="brand" to="/" aria-label={`${SCHOOL.name} Alumni, home`}>
            <Crest />
            <span className="brand-name"><b>{SCHOOL.name}</b><small>Alumni Network</small></span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(n => <Link key={n.to} to={n.to} aria-current={current(n.to)}>{n.label}</Link>)}
            <Link to="/about" aria-current={current('/about')}>About</Link>
          </nav>
          <Link className="header-action" to="/directory" aria-label="Search alumni"><Icon name="search" /></Link>
          <Link className="btn btn-accent btn-sm header-join" to="/join" aria-current={current('/join')}>Join</Link>
        </div>
      </header>

      <main id="main" tabIndex={-1}><Outlet /></main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-top">
            <p className="footer-tag">Once a student, always family.</p>
            <div className="footer-brand">
              <Crest />
              <div><b>{SCHOOL.name}</b><p>Alumni Association · Est. 1958</p></div>
            </div>
          </div>
          <nav aria-label="Footer">
            <Link to="/directory">Alumni directory</Link>
            <Link to="/batches">Batches</Link>
            <Link to="/#events">Events</Link>
            <Link to="/about">About</Link>
          </nav>
          <p className="footer-bottom">© {THIS_YEAR} {SCHOOL.name} Alumni Association</p>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Main">
        {NAV.map(n => (
          <Link key={n.to} to={n.to} aria-current={current(n.to)}><Icon name={n.icon} />{n.label}</Link>
        ))}
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
