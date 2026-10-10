import { Link, useParams } from 'react-router-dom';
import { fullName, getAlumnus, SCHOOL, studentId } from '../api.js';
import { Avatar, Empty, Icon, SocialLinks, useAsync, useTitle } from '../components/ui.jsx';

function Timeline({ items, icon }) {
  return (
    <ol className="timeline">
      {items.map((x, i) => (
        <li key={i}>
          <span className="tl-icon"><Icon name={icon} /></span>
          <div>
            <b>{x.title}</b>
            {x.org && <span>{x.org}</span>}
            {x.when && <time>{x.when}</time>}
          </div>
        </li>
      ))}
    </ol>
  );
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

  const headline = p.joined ? [p.title || p.industry, p.org].filter(Boolean).join(' at ') : null;

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
            </nav>
            <div className="profile-name">
              <h1>{fullName(p)}</h1>
              {p.joined ? <span className="badge badge-success"><Icon name="verified" />Verified</span> : <span className="badge">Not joined yet</span>}
            </div>
            {headline && <p className="profile-headline">{headline}</p>}
            <div className="profile-meta">
              <Link to={`/directory?batch=${p.batch}`}><Icon name="cap" />Batch {p.batch}</Link>
              <span><Icon name="layers" />{p.group}</span>
              <span>ID {studentId(p.id)}</span>
              {p.city && <span><Icon name="pin" />{[p.city, p.country].filter(Boolean).join(', ')}</span>}
              {p.village && <span><Icon name="home" />From {p.village}</span>}
            </div>
            <SocialLinks links={p.socials} name={fullName(p)} />
          </div>
        </div>
      </section>

      <div className="wrap profile-body">
        <div className="profile-main">
          {!p.joined && (
            <section className="card card-pad claim-card">
              <div>
                <h2 className="card-title">Is this you?</h2>
                <p className="text-2">Add your photo, contact, work and education so batchmates can find you.</p>
              </div>
              <Link className="btn btn-primary btn-pulse" to={`/alumni/${studentId(p.id)}/update`}>Update my profile</Link>
            </section>
          )}
          {p.bio && (
            <section className="card card-pad">
              <h2 className="card-title">About</h2>
              <p className="prose">{p.bio}</p>
              {p.quote && <blockquote className="quote">“{p.quote}”</blockquote>}
            </section>
          )}
          {p.career.length > 0 && (
            <section className="card card-pad">
              <h2 className="card-title">Experience</h2>
              <Timeline items={p.career} icon="bag" />
            </section>
          )}
          <section className="card card-pad">
            <h2 className="card-title">Education</h2>
            <Timeline items={p.education} icon="cap" />
          </section>
        </div>

        <aside className="profile-side">
          {p.contact && (p.contact.phone || p.contact.email || p.contact.bloodGroup) && (
            <section className="card card-pad">
              <h2 className="card-title">Contact</h2>
              <ul className="contact-list">
                {p.contact.phone && (
                  <li><span className="tl-icon"><Icon name="phone" /></span>
                    <span><small>Phone</small><a href={`tel:${p.contact.phone.replace(/[^\d+]/g, '')}`}>{p.contact.phone}</a></span></li>
                )}
                {p.contact.email && (
                  <li><span className="tl-icon"><Icon name="mail" /></span>
                    <span><small>Email</small><a href={`mailto:${p.contact.email}`}>{p.contact.email}</a></span></li>
                )}
                {p.contact.bloodGroup && (
                  <li><span className="tl-icon blood"><Icon name="drop" /></span>
                    <span><small>Blood group</small><b>{p.contact.bloodGroup}</b></span></li>
                )}
              </ul>
            </section>
          )}
          <section className="card card-pad">
            <h2 className="card-title">Details</h2>
            <dl className="facts">
              <div><dt>Batch</dt><dd className="num">{p.batch}</dd></div>
              <div><dt>Group</dt><dd>{p.group}</dd></div>
              {p.village && <div><dt>Village</dt><dd>{p.village}</dd></div>}
              <div><dt>School</dt><dd>{SCHOOL.name}</dd></div>
              <div><dt>Status</dt><dd>{p.joined ? 'Verified' : 'Not joined'}</dd></div>
            </dl>
          </section>
          {p.joined && (
            <section className="card card-pad">
              <h2 className="card-title">Is this you?</h2>
              <p className="text-2">Keep your details up to date. We’ll email you a PIN to confirm.</p>
              <Link className="btn btn-secondary btn-block" to={`/alumni/${studentId(p.id)}/update`}>Edit my profile</Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
