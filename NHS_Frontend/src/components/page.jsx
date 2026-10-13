// Building blocks every page uses: the page header, a section heading, and the empty / error state.
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';

export function PageHeader({ crumbs, title, desc, children }) {
  return (
    <header className="page-header">
      <div className="wrap">
        {crumbs && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            {crumbs.map(([to, label]) => (
              <Fragment key={label}><Icon name="chevron" />{to ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</Fragment>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
        {children}
      </div>
    </header>
  );
}

export function SectionHead({ title, desc, to, linkLabel = 'View all' }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
      {to && <Link className="link" to={to}>{linkLabel}<Icon name="arrow" /></Link>}
    </div>
  );
}

export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
