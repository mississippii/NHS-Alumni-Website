import { Link, useParams } from 'react-router-dom';
import { fullName, getAlumnus, studentId } from '../api.js';
import { Avatar, Empty, Icon, SocialLinks, useAsync, useTitle } from '../components/ui.jsx';

/** One row of the profile card: icon, small label, value. */
function Row({ icon, label, children, tone = '' }) {
  return <li><span className={`tl-icon ${tone}`}><Icon name={icon} /></span><span><small>{label}</small>{children}</span></li>;
}

export default function Profile() {
  const id = +useParams().id;
  const { data: p, loading, error } = useAsync(() => getAlumnus(id), [id]);
  useTitle(p ? fullName(p) : loading ? null : 'Profile not found');

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
          action={<Link className="btn btn-primary" to="/directory">Back to directory</Link>}>
          {error ? 'Refresh the page to try again.' : 'It may have been removed.'}
        </Empty>
      </div>
    </div>
  );

  const blood = p.contact?.bloodGroup;
  const phone = p.contact?.phone, email = p.contact?.email;
  const place = [p.city, p.country].filter(Boolean).join(', ');
  const edit = `/alumni/${studentId(p.id)}/update`;

  return (
    <>
      <section className="profile-hero">
        <div className="profile-cover" />
        <div className="wrap profile-id">
          <Avatar person={p} size="xl" />
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link to="/directory">Alumni</Link><Icon name="chevron" />
              <Link to={`/directory?batch=${p.batch}`}>Batch {p.batch}</Link>
              <Icon name="chevron" /><Link to={`/directory?batch=${p.batch}&group=${encodeURIComponent(p.group)}`}>{p.group}</Link>
            </nav>
            <div className="profile-name">
              <h1>{fullName(p)}</h1>
              {p.joined ? <span className="badge badge-success"><Icon name="verified" />Verified</span> : <span className="badge">Not joined yet</span>}
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
        {p.joined ? (
          <section className="profile-info">
            {p.bio && <p className="prose profile-bio">{p.bio}</p>}
            <ul className="contact-list">
              {/* one slot each: occupation ("Engineer at ACME") and highest education (the server picks university over college) */}
              {(p.title || p.org) && <Row icon="bag" label="Occupation"><b>{[p.title, p.org].filter(Boolean).join(' at ')}</b></Row>}
              {p.edu && <Row icon="cap" label="Education"><b>{p.edu}</b></Row>}
              {blood && <Row icon="drop" label="Blood group" tone="blood"><b>{blood}</b></Row>}
              {email && <Row icon="mail" label="Email"><a href={`mailto:${email}`}>{email}</a></Row>}
              {phone && <Row icon="phone" label="Contact"><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></Row>}
              {place && <Row icon="pin" label="Current location"><b>{place}</b></Row>}
            </ul>
            <Link className="btn btn-secondary btn-sm profile-edit" to={edit}>Edit my profile</Link>
          </section>
        ) : (
          <section className="card card-pad claim-card">
            <div>
              <h2 className="card-title">Is this you?</h2>
              <p className="text-2">Add your photo, contact, work and education so batchmates can find you.</p>
            </div>
            <Link className="btn btn-primary btn-pulse" to={edit}>Update my profile</Link>
          </section>
        )}
      </div>
    </>
  );
}
