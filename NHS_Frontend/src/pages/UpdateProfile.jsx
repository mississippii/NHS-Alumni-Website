import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAlumnusRaw, requestPin, saveProfile, SCHOOL, THIS_YEAR } from '../api.js';
import { Avatar, Empty, GROUPS, Icon, SOCIAL, useAsync, useTitle } from '../components/ui.jsx';

const FOUNDED = 1958;
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FIELDS = ['Software', 'Engineering', 'Medicine', 'Education', 'Banking & Finance', 'Business', 'Government', 'Law', 'Agriculture', 'Armed Forces', 'Student'];
const SOCIAL_HINT = { facebook: 'facebook.com/your.name', linkedin: 'linkedin.com/in/your-name', youtube: 'youtube.com/@channel', twitter: 'x.com/username' };
const RESEND_SECONDS = 60;
const EDU_TYPES = ['College', 'University'];
const blankEdu = level => ({ level, institution: '' });
// older rows were saved as HSC / Bachelor's / …
const eduType = level => (!level || /hsc|college/i.test(level) ? 'College' : 'University');

function Field({ label, hint, children, wide }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label">{label}{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}

/** The form's starting values: what the profile already shows publicly (hidden phone/email must be typed again). */
function initial(d) {
  const c = d?.card || {};
  return {
    form: {
      name: '', batch: '', group: '', email: '', phone: d?.contact?.phone || '', bloodGroup: d?.contact?.bloodGroup || '',
      title: c.title || '', org: c.org || '', industry: c.industry || '', city: c.city || '', country: c.country || 'Bangladesh',
      bio: d?.bio || '', showPhone: true, showEmail: true,
    },
    // the API lists newest first; the form goes in study order (college, then university)
    edu: d?.education?.length ? d.education.map(e => ({ level: eduType(e.level), institution: e.institution })).reverse() : [blankEdu('College')],
    socials: { facebook: '', linkedin: '', youtube: '', twitter: '', ...Object.fromEntries((d?.socials || []).map(s => [s.type, s.url])) },
  };
}

/** Phone photos are often 5–10 MB: shrink to ≤1200px JPEG before upload (the server crops it square). */
async function shrink(file) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('Couldn’t read that photo.'))), 'image/jpeg', 0.9));
}

/** "Update my profile" (/alumni/:id/update) and "Join" (/join, for alumni not in the school's records). */
export default function UpdateProfile() {
  const id = +useParams().id || null;
  const { data: d, loading, error } = useAsync(() => (id ? getAlumnusRaw(id) : Promise.resolve(null)), [id]);
  useTitle(id ? 'Update my profile' : 'Join the network');
  if (id && loading) return <div className="wrap profile-skel" aria-busy="true"><div className="skeleton skel-block" /></div>;
  if (id && (error || !d)) return (
    <div className="wrap section"><div className="card">
      <Empty icon="info" title={error ? 'Couldn’t load this profile' : 'Profile not found'}
        action={<Link className="btn btn-primary" to="/directory">Find yourself in the directory</Link>} />
    </div></div>
  );
  return <ProfileFormPage key={id} id={id} person={d?.card} start={initial(d)} />;
}

function ProfileFormPage({ id, person, start }) {
  const [f, setF] = useState(start.form);
  const [edu, setEdu] = useState(start.edu);
  const [socials, setSocials] = useState(start.socials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [photo, setPhoto] = useState(null); // { blob, url }
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

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
  const setRow = (i, k) => e => setEdu(rows => rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const payload = pin => ({
    ...f, pin, socials, batch: f.batch ? +f.batch : null,
    education: edu.filter(r => r.institution.trim()).map(r => ({ level: r.level, institution: r.institution })),
  });

  // Submit → the server checks the form and emails a PIN → the PIN box opens.
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await requestPin(id, payload(null));
      setPinOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) return (
    <div className="wrap section"><div className="card">
      <Empty icon="verified" title={person ? 'Your profile is updated' : 'Welcome to the network!'}
        action={<Link className="btn btn-primary" to={`/alumni/${id || done.id}`}>View my profile</Link>}>
        Batchmates can see your details now. To change them later, open your profile and tap “Edit my profile”.
      </Empty>
    </div></div>
  );

  return (
    <>
      <header className="page-header">
        <div className="wrap">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            {person ? <>
              <Link to={`/directory?batch=${person.batch}`}>Batch {person.batch}</Link><Icon name="chevron" />
              <Link to={`/alumni/${id}`}>{person.name}</Link>
            </> : <><Link to="/">Home</Link><Icon name="chevron" /><span aria-current="page">Join</span></>}
          </nav>
          <h1 className="page-title">{person ? 'Update my profile' : 'Join the network'}</h1>
          <p className="page-desc">
            {person ? `${person.name} · Batch ${person.batch} · ${person.group}`
              : `For ${SCHOOL.name} alumni who can’t find themselves in the directory, including every batch since ${FOUNDED}.`}
          </p>
        </div>
      </header>

      <form className="wrap form" onSubmit={submit}>
        <section className="card card-pad form-card">
          <h2 className="card-title">Photo</h2>
          <div className="photo-pick">
            <Avatar person={{ name: person?.name || f.name || '?', photo: photo?.url || person?.photo }} size="xl" />
            <label className="btn btn-secondary btn-sm">
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
              {photo || person?.photo ? 'Change photo' : 'Add photo'}
            </label>
            {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>Remove</button>}
          </div>
        </section>

        {person && (
          <section className="card card-pad form-card">
            <h2 className="card-title">School record</h2>
            <dl className="facts">
              <div><dt>Name</dt><dd>{person.name}</dd></div>
              <div><dt>Batch</dt><dd className="num">{person.batch}</dd></div>
              <div><dt>Group</dt><dd>{person.group}</dd></div>
            </dl>
            <p className="form-note">From the school’s SSC records. Something wrong? Contact the alumni admin.</p>
          </section>
        )}

        {!person && (
          <section className="card card-pad form-card">
            <h2 className="card-title">Your school days</h2>
            <div className="form-grid">
              <Field label="Full name" wide>
                <input className="input" required minLength={3} maxLength={120} autoComplete="name" value={f.name} onChange={set('name')} />
              </Field>
              <Field label="Batch" hint="SSC year, or the year you’ll sit it">
                <select className="select" required value={f.batch} onChange={set('batch')}>
                  <option value="" disabled>Choose year</option>
                  {Array.from({ length: THIS_YEAR + 5 - FOUNDED + 1 }, (_, i) => THIS_YEAR + 5 - i).map(y => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Group">
                <select className="select" required value={f.group} onChange={set('group')}>
                  <option value="" disabled>Choose group</option>
                  {GROUPS.map(g => <option key={g.name}>{g.name}</option>)}
                </select>
              </Field>
            </div>
          </section>
        )}

        <section className="card card-pad form-card">
          <h2 className="card-title">Contact</h2>
          <div className="form-grid">
            <Field label="Email" hint={person?.joined ? 'The one saved on your profile' : 'We’ll send a PIN here'} wide>
              <input className="input" type="email" required maxLength={120} autoComplete="email" value={f.email} onChange={set('email')} />
            </Field>
            <Field label="Phone" hint="Required">
              <input className="input" type="tel" required pattern="\+?[0-9 \-]{6,20}" title="Phone number, e.g. 01711000000" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={set('phone')} />
            </Field>
            <Field label="Blood group">
              <select className="select" value={f.bloodGroup} onChange={set('bloodGroup')}>
                <option value="">Not set</option>
                {BLOOD.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-switches">
            <label className="switch-row">
              <span><b>Show my phone</b></span>
              <input type="checkbox" role="switch" className="switch" checked={f.showPhone} onChange={set('showPhone')} />
            </label>
            <label className="switch-row">
              <span><b>Show my email</b></span>
              <input type="checkbox" role="switch" className="switch" checked={f.showEmail} onChange={set('showEmail')} />
            </label>
          </div>
        </section>

        <section className="card card-pad form-card">
          <h2 className="card-title">Work &amp; location</h2>
          <div className="form-grid">
            <Field label="Occupation"><input className="input" placeholder="e.g. Software Engineer" value={f.title} onChange={set('title')} /></Field>
            <Field label="Organization"><input className="input" placeholder="Company, office or institute" value={f.org} onChange={set('org')} /></Field>
            <Field label="Field">
              <input className="input" list="fields" value={f.industry} onChange={set('industry')} />
              <datalist id="fields">{FIELDS.map(x => <option key={x} value={x} />)}</datalist>
            </Field>
            <Field label="City"><input className="input" autoComplete="address-level2" value={f.city} onChange={set('city')} /></Field>
            <Field label="Country"><input className="input" autoComplete="country-name" value={f.country} onChange={set('country')} /></Field>
          </div>
        </section>

        <section className="card card-pad form-card">
          <h2 className="card-title">Education after SSC</h2>
          <ol className="edu-rows">
            {edu.map((r, i) => (
              <li key={i} className="edu-row">
                <Field label="Type">
                  <select className="select" required value={r.level} onChange={setRow(i, 'level')}>
                    {EDU_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Institution name">
                  <input className="input" placeholder={`${r.level} name`} value={r.institution} onChange={setRow(i, 'institution')} />
                </Field>
                {edu.length > 1 && (
                  <button type="button" className="btn btn-ghost edu-remove" onClick={() => setEdu(rows => rows.filter((_, j) => j !== i))} aria-label={`Remove institution ${i + 1}`}>
                    <Icon name="x" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          {edu.length < 10 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdu(rows => [...rows, blankEdu('University')])}>+ Add another</button>
          )}
        </section>

        <section className="card card-pad form-card">
          <h2 className="card-title">Social links</h2>
          <div className="form-grid">
            {Object.entries(SOCIAL).map(([k, s]) => (
              <Field key={k} label={s.label}>
                <span className="input-brand">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ color: s.color }}>{s.svg}</svg>
                  <input className="input" inputMode="url" autoCapitalize="off" spellCheck="false" placeholder={SOCIAL_HINT[k]}
                    value={socials[k]} onChange={e => setSocials(x => ({ ...x, [k]: e.target.value }))} />
                </span>
              </Field>
            ))}
          </div>
        </section>

        <section className="card card-pad form-card">
          <h2 className="card-title">About you</h2>
          <Field label="A few lines for your batchmates" hint={`${f.bio.length}/2000`}>
            <textarea className="input textarea" rows="4" maxLength={2000} value={f.bio} onChange={set('bio')} />
          </Field>
        </section>

        <div className="form-submit">
          {error && <p className="err" role="alert">{error}</p>}
          <p className="text-2">We’ll email you a PIN to confirm.</p>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending PIN…' : 'Submit'}</button>
        </div>
      </form>

      {pinOpen && (
        <PinDialog email={f.email} onClose={() => setPinOpen(false)}
          onResend={() => requestPin(id, payload(null))}
          onConfirm={async pin => setDone(await saveProfile(id, payload(pin), photo?.blob))} />
      )}
    </>
  );
}

/** The "enter your PIN" box. Native <dialog>: focus trap, Escape and the backdrop come with it. */
function PinDialog({ email, onClose, onConfirm, onResend }) {
  const ref = useRef(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => { ref.current.showModal(); }, []);
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const run = async (fn, after) => {
    setBusy(true); setMsg(null);
    try { await fn(); after?.(); } catch (err) { setMsg({ err: true, text: err.message }); } finally { setBusy(false); }
  };
  const confirm = e => { e.preventDefault(); run(() => onConfirm(pin)); };
  const resend = () => run(onResend, () => { setWait(RESEND_SECONDS); setPin(''); setMsg({ text: 'A new PIN is on its way.' }); });

  return (
    <dialog ref={ref} className="pin-dialog" onClose={onClose} aria-labelledby="pin-title">
      <form onSubmit={confirm}>
        <span className="pin-icon"><Icon name="mail" /></span>
        <h2 id="pin-title">Check your email</h2>
        <p className="text-2">We sent a 6-digit PIN to <b>{email}</b>. It works for 10 minutes.</p>
        <input className="input pin-input num" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}"
          maxLength={6} placeholder="••••••" aria-label="PIN" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
        {msg && <p className={msg.err ? 'err' : 'text-2'} role={msg.err ? 'alert' : 'status'}>{msg.text}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || pin.length !== 6}>{busy ? 'Saving…' : 'Confirm'}</button>
        <div className="pin-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Change email</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={busy || wait > 0}>
            {wait > 0 ? `Resend in ${wait}s` : 'Resend PIN'}
          </button>
        </div>
        <p className="pin-note">Not in your inbox? Check the spam folder.</p>
      </form>
    </dialog>
  );
}
