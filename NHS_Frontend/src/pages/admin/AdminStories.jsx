import { useEffect, useState } from 'react';
import { deleteStory, saveStory } from '../../api/admin.js';
import { getAlumnusRaw } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Field } from '../../components/form/Field.jsx';
import { Empty } from '../../components/page.jsx';
import { currentId, storyName, studentId } from '../../lib/format.js';
import { shrink } from '../../lib/photo.js';
import { THIS_YEAR } from '../../lib/school.js';

const BLANK = { id: null, studentId: '', name: '', batch: '', title: '', role: '', quote: '', body: '', removePhoto: false };

/** Stories: the editor on top, then the published stories. */
export default function AdminStories({ token, list, reload }) {
  const [f, setF] = useState(BLANK);
  const [current, setCurrent] = useState(null); // the photo the story being edited already has
  const [photo, setPhoto] = useState(null);     // { blob, url } picked now
  const [student, setStudent] = useState(null); // the record the student ID points at
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  // Show whose record the student ID is, so a typo is noticed before saving.
  useEffect(() => {
    const id = f.studentId.trim();
    if (!/^\d{6,9}$/.test(id)) { setStudent(null); return; }
    let live = true;
    getAlumnusRaw(currentId(+id)).then(d => live && setStudent(d ? d.card : false), () => live && setStudent(null));
    return () => { live = false; };
  }, [f.studentId]);

  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const edit = ({ story: s }) => {
    setF({ ...BLANK, id: s.id, studentId: s.alumnusId ? studentId(s.alumnusId) : '', name: s.name || '',
      batch: !s.alumnusId && s.batch ? String(s.batch) : '', title: s.title, role: s.role || '', quote: s.quote || '', body: s.body });
    setCurrent(s.photo); setPhoto(null); setSaved(null); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => { setF(BLANK); setCurrent(null); setPhoto(null); setError(null); };
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
    setBusy(true); setError(null); setSaved(null);
    try {
      const r = await saveStory(token, { ...f, studentId: f.studentId ? currentId(+f.studentId) : null, batch: f.batch ? +f.batch : null }, photo?.blob);
      setSaved(r.story);
      reset();
      reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const act = async (fn, s, ask) => {
    if (ask && !window.confirm(ask)) return;
    setError(null);
    try { await fn(token, s.id); reload(); } catch (e) { setError(e.message); }
  };

  const shown = photo?.url || (!f.removePhoto && current);
  return (
    <div className="wrap form admin-page">
      <form className="card card-pad form-card form-one" onSubmit={submit}>
        <h2 className="card-title">{f.id ? 'Edit story' : 'New story'}</h2>
        <div className="form-grid">
          <Field label="Student ID">
            <input className="input" inputMode="numeric" maxLength={9} placeholder="e.g. 201303003" value={f.studentId} onChange={set('studentId')} />
          </Field>
          {f.studentId && (
            <p className="wide admin-who">
              {student ? <><Avatar person={student} size="sm" /><span><b>{student.name || 'Name not added yet'}</b> · Batch {student.batch} · {student.group}</span></>
                : student === false ? <span className="err">No student with this ID.</span> : null}
            </p>
          )}
          <Field label={f.studentId ? 'Name shown' : 'Name'} required={!f.studentId}>
            <input className="input" required={!f.studentId} maxLength={120} value={f.name} onChange={set('name')} />
          </Field>
          {f.studentId ? (
            <Field label="Now"><input className="input" maxLength={150} value={f.role} onChange={set('role')} /></Field>
          ) : (
            <Field label="Batch"><input className="input" type="number" min="1958" max={THIS_YEAR} value={f.batch} onChange={set('batch')} /></Field>
          )}
          {!f.studentId && <Field label="Now" wide><input className="input" maxLength={150} value={f.role} onChange={set('role')} /></Field>}
          <Field label="Headline" wide required><input className="input" required maxLength={150} value={f.title} onChange={set('title')} /></Field>
          <Field label="Quote" wide>
            <input className="input" maxLength={400} value={f.quote} onChange={set('quote')} />
          </Field>
          <Field label="Story" wide required>
            <textarea className="input textarea story-input" required rows="12" value={f.body} onChange={set('body')} />
          </Field>
        </div>
        <div className="photo-pick">
          {shown && <img className="story-thumb" src={shown} alt="" />}
          <label className="btn btn-secondary btn-sm">
            <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
            {shown ? 'Change photo' : 'Add photo'}
          </label>
          {shown && <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => (photo ? setPhoto(null) : setF(s => ({ ...s, removePhoto: true })))}>Remove</button>}
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {saved && <p className="text-2">Saved. <a className="link" href={`/stories/${saved.id}`} target="_blank" rel="noreferrer">View “{saved.title}”</a></p>}
        <div className="admin-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Publish story'}</button>
          {f.id && <button className="btn btn-secondary" type="button" onClick={reset}>Cancel</button>}
        </div>
      </form>

      {list?.length === 0 && <div className="card"><Empty icon="book" title="No stories yet" /></div>}
      {list?.length > 0 && <h2 className="admin-list-title">Published ({list.length})</h2>}
      {list?.map(item => {
        const s = item.story;
        return (
          <section key={s.id} className="card card-pad admin-story">
            {s.photo ? <img className="story-thumb" src={s.photo} alt="" /> : <Avatar person={{ name: s.name, group: s.group }} size="lg" />}
            <div>
              <span className="story-tag">{s.published}</span>
              <b>{s.title}</b>
              <span className="text-2">{storyName(s)}{s.batch ? ` · Batch ${s.batch}` : ''}</span>
              <div className="admin-actions">
                <a className="btn btn-secondary btn-sm" href={`/stories/${s.id}`} target="_blank" rel="noreferrer">View</a>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => edit(item)}>Edit</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => act(deleteStory, s, `Delete “${s.title}”?`)}>Delete</button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
