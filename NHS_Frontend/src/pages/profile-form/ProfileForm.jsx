import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStats, requestPin, saveProfile } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { BloodPicker } from '../../components/form/BloodPicker.jsx';
import { CodePicker } from '../../components/form/CodePicker.jsx';
import { EduRows } from '../../components/form/EduRows.jsx';
import { Field } from '../../components/form/Field.jsx';
import { socialMap, SocialInputs } from '../../components/form/SocialInputs.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Empty } from '../../components/page.jsx';
import { fullName, studentId } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { shrink } from '../../lib/photo.js';
import { FOUNDED, GROUPS, SCHOOL, SEXES } from '../../lib/school.js';
import PinDialog from './PinDialog.jsx';

/** Male / Female, prefilled from the school's records when they have it. */
function SexField({ value, onChange }) {
  return (
    <Field label="Sex" required>
      <select className="select" required value={value} onChange={onChange}>
        <option value="" disabled>Choose</option>
        {Object.entries(SEXES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </Field>
  );
}
/** The profile form itself: photo, record fields, contact, work, education, links, comment; Submit sends a PIN to confirm. */
/** pin = already checked by "Edit profile" (claimed profiles): Save goes straight through. */
export default function ProfileForm({ id, person, start, moved, pin }) {
  const [f, setF] = useState(start.form);
  const [edu, setEdu] = useState(start.edu);
  const [socials, setSocials] = useState(start.socials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [photo, setPhoto] = useState(null); // { blob, url }
  // Join is only for batches older than the school's records; anyone in the records updates their existing profile.
  // The cut-off comes from the school's sheets only, so alumni who already joined (e.g. batch 1992) don't move it.
  const stats = useAsync(getStats, []);
  const lastJoin = (stats.data?.firstRecordBatch ?? 2006) - 1;
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  // saved: a short spinner, then straight back to the profile
  const navigate = useNavigate();
  useEffect(() => {
    if (!done || !person) return;
    const t = setTimeout(() => navigate(`/alumni/${studentId(id)}`, { replace: true }), 700);
    return () => clearTimeout(t);
  }, [done, person, id, navigate]);

  const pickPhoto = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const blob = await shrink(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError('That file isn’t a photo we can use. Try a JPEG or PNG.');
    }
  };

  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const payload = pin => ({
    ...f, phone: `${f.cc} ${f.phone}`, pin, socials: socialMap(socials), batch: f.batch ? +f.batch : null,
    education: edu.filter(r => r.institution.trim()).map(r => ({ level: r.level, institution: r.institution })),
  });

  // Submit → the server checks the form and emails a PIN → the PIN box opens.
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      // Edit profile: already unlocked, so save at once, unless the email changed: then a PIN to the new one first
      const moved = pin && f.email.trim().toLowerCase() !== start.form.email.toLowerCase();
      if (pin && !moved) return setDone(await saveProfile(id, payload(pin), photo?.blob));
      await requestPin(id, payload(pin));
      setPinOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // A join waits for an admin; updates to a listed record go live at once.
  if (done?.status === 'PENDING') return (
    <div className="wrap section"><div className="card">
      <Empty icon="inbox" title="Request sent" action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
        Thank you! An admin will check your details. Your profile appears in the directory once it’s approved.
      </Empty>
    </div></div>
  );
  if (done) return <div className="wrap section saving" aria-busy="true"><span className="spinner" role="status" aria-label="Saving" /></div>;

  return (
    <>
      <header className="page-header">
        <div className="wrap form-head">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {person ? <>
              <Link to={`/directory?batch=${person.batch}`}>Batch {person.batch}</Link><Icon name="chevron" />
              <Link to={`/alumni/${studentId(id)}`}>{fullName(person)}</Link>
            </> : <><Link to="/">Home</Link><Icon name="chevron" /><span aria-current="page">Join</span></>}
          </nav>
          <h1 className="page-title">{person ? 'Update my profile' : 'Join the network'}</h1>
          <p className="page-desc">
            {person ? `${fullName(person)} · Student ID ${studentId(id)} · Batch ${person.batch} · ${person.group}`
              : <>For {SCHOOL.name} batches {FOUNDED}–{lastJoin}. From {lastJoin + 1} on you’re already listed: <Link className="link" to="/alumni">find your batch</Link> and update your profile. An admin approves each request.</>}
          </p>
          {moved && <p className="moved-note"><Icon name="info" />Your roll belongs to this profile, not {studentId(moved)}, so your details will be saved here.</p>}
        </div>
      </header>

      <form className="wrap form" onSubmit={submit}>
        <section className="card card-pad form-card form-one">
          <div className="form-part">
            <div className="photo-pick">
              <Avatar person={{ name: person?.name || f.name || '?', photo: photo?.url || person?.photo }} size="xl" />
              <label className="btn btn-secondary btn-sm">
                <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
                {photo || person?.photo ? 'Change photo' : 'Add photo'}
              </label>
              {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>Remove</button>}
            </div>
          </div>

          {person && (
            <div className="form-part">
              {/* from the school's SSC records: shown locked, the server never changes them on update */}
              <div className="form-grid">
                {person.name
                  ? <Field label="Name" hint="Can’t be changed" wide><input className="input" value={person.name} readOnly disabled /></Field>
                  : <Field label="Full name" hint="As on your SSC certificate" wide required>
                      <input className="input" required minLength={3} maxLength={120} autoComplete="name" value={f.name} onChange={set('name')} />
                    </Field>}
                <Field label="Batch"><input className="input num" value={person.batch} readOnly disabled /></Field>
                <Field label="Group"><input className="input" value={person.group} readOnly disabled /></Field>
                <SexField value={f.sex} onChange={set('sex')} />
                <Field label="Village" required>
                  <input className="input" required maxLength={80} autoComplete="address-level3" value={f.village} onChange={set('village')} />
                </Field>
              </div>
              <p className="form-note">Name, batch and group come from the school’s SSC records. Something wrong? Contact the alumni admin.</p>
            </div>
          )}

          {!person && (
            <div className="form-part">
              <div className="form-grid">
                <Field label="Full name" wide required>
                  <input className="input" required minLength={3} maxLength={120} autoComplete="name" value={f.name} onChange={set('name')} />
                </Field>
                <Field label="Batch" hint={`SSC year, ${FOUNDED}–${lastJoin}`} required>
                  <select className="select" required value={f.batch} onChange={set('batch')}>
                    <option value="" disabled>Choose year</option>
                    {Array.from({ length: lastJoin - FOUNDED + 1 }, (_, i) => lastJoin - i).map(y => <option key={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="Group" required>
                  <select className="select" required value={f.group} onChange={set('group')}>
                    <option value="" disabled>Choose group</option>
                    {GROUPS.map(g => <option key={g.name}>{g.name}</option>)}
                  </select>
                </Field>
                <SexField value={f.sex} onChange={set('sex')} />
                <Field label="Village" required>
                  <input className="input" required maxLength={80} autoComplete="address-level3" value={f.village} onChange={set('village')} />
                </Field>
              </div>
            </div>
          )}

          <div className="form-part">
            <div className="form-grid">
              <Field label="Email" hint={person?.joined ? 'Shown on your profile · a new one gets a PIN to confirm it' : 'We’ll send a PIN here · shown on your profile'} wide required>
                <input className="input" type="email" required maxLength={120} autoComplete="email" value={f.email} onChange={set('email')} />
              </Field>
              <Field label="Phone" wide required>
                <div className="phone-input">
                  <CodePicker value={f.cc} onChange={cc => setF(s => ({ ...s, cc }))} />
                  <input className="input" type="tel" required pattern="[0-9 \-]{6,16}" title="Number without the country code, e.g. 1712 345678"
                    autoComplete="tel-national" placeholder={f.cc === '+880' ? '1712 345678' : 'Phone number'} value={f.phone} onChange={set('phone')} />
                </div>
              </Field>
              <Field label="Date of birth" hint="Not shown on your profile" required>
                <input className="input" type="date" required min="1930-01-01" max={new Date().toISOString().slice(0, 10)} value={f.birthDate} onChange={set('birthDate')} />
              </Field>
              <Field label="Blood group">
                <BloodPicker value={f.bloodGroup} onChange={bloodGroup => setF(s => ({ ...s, bloodGroup }))} />
              </Field>
            </div>
            <div className="form-switches">
              <label className="switch-row">
                <span><b>Show my phone</b></span>
                <input type="checkbox" role="switch" className="switch" checked={f.showPhone} onChange={set('showPhone')} />
              </label>
            </div>
          </div>

          <div className="form-part">
            <div className="form-grid">
              <Field label="Occupation"><input className="input" placeholder="e.g. Software Engineer" value={f.title} onChange={set('title')} /></Field>
              <Field label="Organization"><input className="input" placeholder="Company, office or institute" value={f.org} onChange={set('org')} /></Field>
              <Field label="Current city"><input className="input" autoComplete="address-level2" value={f.city} onChange={set('city')} /></Field>
              <Field label="Current country"><input className="input" autoComplete="country-name" value={f.country} onChange={set('country')} /></Field>
            </div>
          </div>

          <div className="form-part">
            <EduRows edu={edu} setEdu={setEdu} />
          </div>

          <div className="form-part">
            <SocialInputs socials={socials} setSocials={setSocials} />
          </div>

          <div className="form-part">
            <Field label="Comment" hint={`${f.bio.length}/2000`}>
              <textarea className="input textarea" rows="4" maxLength={2000} placeholder="Say something to your batchmates. It shows on the Events page with your photo."
                value={f.bio} onChange={set('bio')} />
            </Field>
          </div>
        </section>

        <div className="form-submit">
          {error && <p className="err" role="alert">{error}</p>}
          {!pin && <p className="text-2">We’ll email you a PIN to confirm.</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{pin ? (busy ? 'Saving…' : 'Save') : busy ? 'Sending PIN…' : 'Submit'}</button>
        </div>
      </form>

      {pinOpen && (
        <PinDialog email={f.email} onClose={() => setPinOpen(false)}
          onResend={() => requestPin(id, payload(pin))}
          onConfirm={async p => setDone(await saveProfile(id, pin ? { ...payload(pin), emailPin: p } : payload(p), photo?.blob))} />
      )}
    </>
  );
}
