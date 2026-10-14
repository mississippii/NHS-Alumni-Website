import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getAlumnusRaw } from '../../api/public.js';
import { blankEdu, eduType } from '../../components/form/EduRows.jsx';
import { socialRows } from '../../components/form/SocialInputs.jsx';
import { Empty } from '../../components/page.jsx';
import { currentId } from '../../lib/format.js';
import { useAsync, useTitle } from '../../lib/hooks.js';
import { ROLL_CHECK_FROM } from '../../lib/school.js';
import ProfileForm from './ProfileForm.jsx';
import EditGate from './EditGate.jsx';
import RollGate from './RollGate.jsx';

/** The form's starting values: what the profile shows publicly, plus u = its private fields once "Edit profile" is unlocked. */
function initial(d, u) {
  const c = d?.card || {};
  const [, cc = '+880', num = ''] = (u?.phone || d?.contact?.phone || '').match(/^(\+\d{1,3}) (.*)$/) || [];
  return {
    form: {
      name: '', batch: '', group: '', village: d?.village || '', email: u?.email || d?.contact?.email || '', cc, phone: num, birthDate: u?.birthDate || '', sex: d?.sex || '', bloodGroup: d?.contact?.bloodGroup || '',
      title: c.title || '', org: c.org || '', industry: c.industry || '', city: c.city || '', country: c.country || 'Bangladesh',
      bio: d?.bio || '', showPhone: u?.showPhone ?? true,
    },
    // the API lists newest first; the form goes in study order (college, then university)
    edu: d?.education?.length ? d.education.map(e => ({ level: eduType(e.level), institution: e.institution })).reverse() : [blankEdu('College')],
    socials: socialRows(d?.socials),
  };
}
/** "Update my profile" (/alumni/:id/update) and "Join" (/join, for alumni not in the school's records). */
export default function UpdateProfile() {
  const id = currentId(+useParams().id) || null;
  const { data: d, loading, error } = useAsync(() => (id ? getAlumnusRaw(id) : Promise.resolve(null)), [id]);
  // The SSC roll, once it matched. It rides in the page's history state, so switching to the roll's own profile keeps it.
  const { roll, moved } = useLocation().state || {};
  const [unlocked, setUnlocked] = useState(null); // { id, pin, ...private fields } after the email PIN
  useTitle(id ? 'Update my profile' : 'Join the network');
  if (id && loading) return <div className="wrap profile-skel" aria-busy="true"><div className="skeleton skel-block" /></div>;
  if (id && (error || !d)) return (
    <div className="wrap section"><div className="card">
      <Empty icon="info" title={error ? 'Couldn’t load this profile' : 'Profile not found'}
        action={<Link className="btn btn-primary" to="/alumni">Find your batch</Link>} />
    </div></div>
  );
  const person = d?.card && { ...d.card, sex: d.sex }; // sex comes from the school's sheets for most
  if (person && !person.name && person.batch >= ROLL_CHECK_FROM && !roll) return <RollGate id={id} person={person} />;
  const u = unlocked?.id === id ? unlocked : null;
  if (person?.joined && !u) return <EditGate id={id} person={person} onUnlock={setUnlocked} />;
  const start = initial(d, u);
  start.form.roll = roll ? +roll : null;
  return <ProfileForm key={id} id={id} person={person} start={start} moved={moved} pin={u?.pin} />;
}
