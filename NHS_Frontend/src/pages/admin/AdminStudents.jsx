import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminStudent, saveMemorial } from '../../api/admin.js';
import { listAlumni } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Carousel } from '../../components/Carousel.jsx';
import { blankEdu, EduRows, eduType } from '../../components/form/EduRows.jsx';
import { Field } from '../../components/form/Field.jsx';
import { socialMap, socialRows, SocialInputs } from '../../components/form/SocialInputs.jsx';
import { SectionHead } from '../../components/page.jsx';
import { ProfileCard } from '../../components/people.jsx';
import { currentId, studentId } from '../../lib/format.js';
import { shrink } from '../../lib/photo.js';
import { BLOOD_GROUPS, GROUPS, SEXES, THIS_YEAR } from '../../lib/school.js';

const NO_MEMORIAL = { deceased: true, passedOn: '', name: '', village: '', email: '', phone: '', title: '', org: '', bio: '', batch: '', group: '',
  birthDate: '', bloodGroup: '', industry: '', city: '', country: '', sex: '' };

/** Admin home: open any student by Student ID, edit everything, or mark them as passed away with the date.
 *  Also adds someone who passed away and has no record (SSC before 2006), and lists the members who joined last. */
export default function AdminStudents({ token }) {
  const [list, setList] = useState(null);
  const [params] = useSearchParams(); // ?sid= from "Fix profile" on a help request
  const [sid, setSid] = useState(params.get('sid') || '');
  const [rec, setRec] = useState(null);      // the record being edited; { id: null } = a new person
  const [f, setF] = useState(NO_MEMORIAL);
  const [photo, setPhoto] = useState(null);  // { blob, url } picked now
  const [edu, setEdu] = useState([blankEdu('College')]);
  const [socials, setSocials] = useState(socialRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  // recently joined members, newest first (the same list the website's home page shows)
  const reload = () => listAlumni({ joined: true, sort: 'joined', size: 10 }).then(r => setList(r.items), e => setError(e.message));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const open = r => {
    setRec(r); setPhoto(null); setSaved(null); setError(null);
    const { education, socials: links, ...rest } = r;
    setF(r.id ? { ...NO_MEMORIAL, ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? ''])), deceased: !!r.deceased } : NO_MEMORIAL);
    setEdu(education?.length ? education.map(e => ({ level: eduType(e.level), institution: e.institution })) : [blankEdu('College')]);
    setSocials(socialRows(links));
  };
  const find = async e => {
    e?.preventDefault();
    setError(null);
    try { open(await adminStudent(token, currentId(+sid))); } catch (err) { setRec(null); setError(err.message); }
  };
  useEffect(() => { if (sid) find(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pickPhoto = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const blob = await shrink(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch { setError('That file isn’t a photo we can use. Try a JPEG or PNG.'); }
  };
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await saveMemorial(token, rec.id, {
        ...f, passedOn: f.passedOn || null, birthDate: f.birthDate || null, batch: f.batch ? +f.batch : null, socials: socialMap(socials),
        education: edu.filter(r => r.institution.trim()).map(r => ({ level: r.level, institution: r.institution })),
      }, photo?.blob);
      setSaved(r); setRec(null); setSid('');
      reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const shown = photo?.url || rec?.photo;
  return (
    <div className="wrap form admin-page">
      {!rec && (
        <form className="card card-pad form-card form-one" onSubmit={find}>
          <h2 className="card-title">Find a student</h2>
          <div className="memorial-find">
            <Field label="Student ID">
              <input className="input num" required inputMode="numeric" pattern="[0-9]{6,9}" maxLength={9} placeholder="e.g. 200503012"
                value={sid} onChange={e => setSid(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <button className="btn btn-primary" type="submit">Open</button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm admin-add" onClick={() => open({ id: null })}>+ Add someone not on the website</button>
          {error && <p className="err" role="alert">{error}</p>}
          {saved && <p className="text-2">Saved. <a className="link" href={`/alumni/${studentId(saved.id)}`} target="_blank" rel="noreferrer">View {saved.name}’s profile</a></p>}
        </form>
      )}

      {rec && (
        <form className="card card-pad form-card form-one" onSubmit={submit}>
          {rec.id ? (
            <div className="admin-head admin-student">
              <div>
                <b>{rec.name || 'Name not added yet'}</b>
                <span>Student ID {studentId(rec.id)} · Batch {rec.batch} · {rec.group}</span>
                <span className="admin-status">
                  {rec.deceased ? <span className="badge badge-memorial">Remembering</span>
                    : rec.status === 'VERIFIED' ? <span className="badge badge-success">Joined</span> : <span className="badge">Not joined yet</span>}
                  <a className="link" href={`/alumni/${studentId(rec.id)}`} target="_blank" rel="noreferrer">View profile</a>
                </span>
              </div>
            </div>
          ) : <h2 className="card-title">New person</h2>}
          <div className="photo-pick">
            <Avatar person={{ name: f.name || rec.name || '?', group: rec.group || f.group, photo: shown }} size="xl" />
            <label className="btn btn-secondary btn-sm">
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
              {shown ? 'Change photo' : 'Add photo'}
            </label>
          </div>
          <div className="form-grid">
            {rec.id && (
              <label className="switch-row wide">
                <span><b>Passed away</b></span>
                <input type="checkbox" role="switch" className="switch" checked={f.deceased} onChange={set('deceased')} />
              </label>
            )}
            {!rec.id && <>
              <Field label="Batch (SSC year)" required>
                <input className="input" type="number" required min="1958" max={THIS_YEAR} value={f.batch} onChange={set('batch')} />
              </Field>
              <Field label="Group" required>
                <select className="select" required value={f.group} onChange={set('group')}>
                  <option value="" disabled>Choose group</option>
                  {GROUPS.map(g => <option key={g.name}>{g.name}</option>)}
                </select>
              </Field>
            </>}
            <Field label="Name" wide required={!rec.name}>
              <input className="input" required={!rec.name} maxLength={120} value={f.name} onChange={set('name')} />
            </Field>
            {f.deceased && <Field label="Date of death" hint={rec.passedYear && !rec.passedOn ? `Saved: ${rec.passedYear}` : null}>
              <input className="input" type="date" min={`${rec.batch || f.batch || 1958}-01-01`} max={new Date().toISOString().slice(0, 10)}
                value={f.passedOn} onChange={set('passedOn')} />
            </Field>}
            <Field label="Village"><input className="input" maxLength={80} value={f.village} onChange={set('village')} /></Field>
            <Field label="Sex">
              <select className="select" value={f.sex} onChange={set('sex')}>
                <option value="">Not set</option>
                {Object.entries(SEXES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Date of birth">
              <input className="input" type="date" min="1930-01-01" max={new Date().toISOString().slice(0, 10)} value={f.birthDate} onChange={set('birthDate')} />
            </Field>
            <Field label="Email"><input className="input" type="email" maxLength={120} value={f.email} onChange={set('email')} /></Field>
            <Field label="Phone"><input className="input" type="tel" maxLength={20} placeholder="01712 345678" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Blood group">
              <select className="select" value={f.bloodGroup} onChange={set('bloodGroup')}>
                <option value="">Not set</option>
                {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Occupation"><input className="input" maxLength={120} placeholder="e.g. Software Engineer" value={f.title} onChange={set('title')} /></Field>
            <Field label="Organization"><input className="input" maxLength={120} placeholder="Company, office or institute" value={f.org} onChange={set('org')} /></Field>
            <Field label="Current city"><input className="input" maxLength={80} value={f.city} onChange={set('city')} /></Field>
            <Field label="Country"><input className="input" maxLength={80} value={f.country} onChange={set('country')} /></Field>
            <Field label="About" wide>
              <textarea className="input textarea" rows="4" maxLength={2000} value={f.bio} onChange={set('bio')} />
            </Field>
          </div>
          <div className="form-part"><EduRows edu={edu} setEdu={setEdu} /></div>
          <div className="form-part">
            <SocialInputs socials={socials} setSocials={setSocials} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="admin-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => { setRec(null); setError(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {list?.length > 0 && (
        <div className="admin-joined">
          <SectionHead title="Recently joined" to="/directory?joined=true&sort=joined" />
          <Carousel arrows={list.length > 4}>{list.map(p => <ProfileCard key={p.id} person={p} />)}</Carousel>
        </div>
      )}
    </div>
  );
}
