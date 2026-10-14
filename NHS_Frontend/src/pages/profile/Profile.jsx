import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAlumnus } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty } from '../../components/page.jsx';
import { SocialLinks } from '../../components/SocialLinks.jsx';
import { currentId, fullName, memorialLine, studentId } from '../../lib/format.js';
import { useAsync, useTitle } from '../../lib/hooks.js';
import HelpDialog from './HelpDialog.jsx';

/** One row of the profile card: icon, small label, value. */
function Row({ icon, label, children, tone = '' }) {
  return <li><span className={`tl-icon ${tone}`}><Icon name={icon} /></span><span><small>{label}</small>{children}</span></li>;
}

/** ⋮ next to the name of a claimed profile: Edit profile (needs the email PIN) and Help. */
function MoreMenu({ edit, onHelp }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => (e.key === 'Escape' || (e.type === 'pointerdown' && !ref.current.contains(e.target))) && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div className="more" ref={ref}>
      <button className="more-btn" type="button" aria-label="More options" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="dots" /></button>
      {open && (
        <div className="more-menu" role="menu">
          <Link role="menuitem" to={edit}><Icon name="edit" />Edit profile</Link>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); onHelp(); }}><Icon name="info" />Help</button>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const id = currentId(+useParams().id);
  const { data: p, loading, error } = useAsync(() => getAlumnus(id), [id]);
  useTitle(p ? fullName(p) : loading ? null : 'Profile not found');
  const [help, setHelp] = useState(false);

  if (loading) return (
    <div className="wrap profile-skel" aria-busy="true">
      <span className="skeleton skel-line" />
      <div className="skeleton skel-block" />
    </div>
  );
  if (error || !p) return (
    <div className="wrap section">
      <div className="card">
        <Empty icon={error ? 'info' : 'search'} title={error ? 'Couldn’t load this profile' : 'Profile not found'}
          action={<Link className="btn btn-primary" to="/alumni">Back to alumni</Link>}>
          {error ? 'Refresh the page to try again.' : 'It may have been removed.'}
        </Empty>
      </div>
    </div>
  );

  const blood = p.contact?.bloodGroup;
  const phone = p.contact?.phone, email = p.contact?.email;
  const place = [p.city, p.country].filter(Boolean).join(', ');
  const edit = `/alumni/${studentId(p.id)}/update`;
  const helpBtn = <button className="btn btn-secondary btn-sm" type="button" onClick={() => setHelp(true)} aria-expanded={help}><Icon name="info" />Help</button>;

  return (
    <>
      <section className="profile-hero">
        <div className="profile-cover" />
        <div className="wrap profile-id">
          <Avatar person={p} size="xl" />
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link to="/alumni">Alumni</Link><Icon name="chevron" />
              <Link to={`/directory?batch=${p.batch}`}>Batch {p.batch}</Link>
              <Icon name="chevron" /><Link to={`/directory?batch=${p.batch}&group=${encodeURIComponent(p.group)}`}>{p.group}</Link>
            </nav>
            <div className="profile-name">
              <h1>{fullName(p)}</h1>
              {p.memorial ? <span className="badge badge-memorial"><Icon name="ribbon" />{memorialLine(p)}</span>
                : p.joined ? <span className="verified-mark" title="Verified" role="img" aria-label="Verified"><Icon name="verified" /></span> : <span className="badge">Not joined yet</span>}
              {p.joined && <MoreMenu edit={edit} onHelp={() => setHelp(true)} />}
            </div>
            <div className="profile-meta">
              <span className="profile-sid"><Icon name="idcard" />Student ID: <b className="num">{studentId(p.id)}</b></span>
              {p.village && <span><Icon name="home" />{p.village}</span>}
            </div>
            <SocialLinks links={p.socials} name={fullName(p)} />
          </div>
        </div>
      </section>

      <div className="wrap profile-body">
        {p.joined || p.memorial ? (
          <section className="profile-info">
            {p.memorial && p.bio && <p className="prose profile-bio">{p.bio}</p>} {/* members' comments show on Events instead */}
            <ul className="contact-list">
              {/* one slot each: occupation ("Engineer at ACME") and highest education (the server picks university over college) */}
              {(p.title || p.org) && <Row icon="bag" label="Occupation"><b>{[p.title, p.org].filter(Boolean).join(' at ')}</b></Row>}
              {p.edu && <Row icon="cap" label="Education"><b>{p.edu}</b></Row>}
              {blood && <Row icon="drop" label="Blood group" tone="blood"><b>{blood}</b></Row>}
              {email && <Row icon="mail" label="Email"><a href={`mailto:${email}`}>{email}</a></Row>}
              {phone && <Row icon="phone" label="Contact"><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></Row>}
              {place && <Row icon="pin" label="Present address"><b>{place}</b></Row>}
            </ul>
          </section>
        ) : (
          <section className="card card-pad claim-card">
            <div>
              <h2 className="card-title">Is this you?</h2>
              <p className="text-2">Add your photo, contact, work and education so batchmates can find you.</p>
            </div>
            <div className="claim-actions">
              <Link className="btn btn-primary btn-pulse" to={edit}>Update my profile</Link>
              {helpBtn}
            </div>
          </section>
        )}
        {help && <HelpDialog id={p.id} onClose={() => setHelp(false)} />}
      </div>
    </>
  );
}
