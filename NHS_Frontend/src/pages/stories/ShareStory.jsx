import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAlumnusRaw, submitStory } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Field } from '../../components/form/Field.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { currentId } from '../../lib/format.js';
import { useTitle } from '../../lib/hooks.js';
import { shrink } from '../../lib/photo.js';

/** /stories/share: a student sends a story under their student ID; it appears once the admin approves it. */
export default function ShareStory() {
  useTitle('Share a story');
  const [f, setF] = useState({ studentId: '', body: '', website: '' });
  const [photo, setPhoto] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [student, setStudent] = useState(null); // whose record the ID is: shown so a typo is noticed before sending
  useEffect(() => {
    const id = f.studentId.trim();
    if (!/^\d{6,9}$/.test(id)) { setStudent(null); return; }
    let live = true;
    getAlumnusRaw(currentId(+id)).then(d => live && setStudent(d ? d.card : false), () => live && setStudent(null));
    return () => { live = false; };
  }, [f.studentId]);
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

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
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await submitStory({ ...f, studentId: currentId(+f.studentId.trim()) }, photo?.blob);
      setSent(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (sent) return (
    <div className="wrap section"><div className="card">
      <Empty icon="inbox" title="Thank you for sharing!" action={<Link className="btn btn-primary" to="/stories">Back to stories</Link>}>
        An admin will read your story. It appears on the Stories page once it’s approved.
      </Empty>
    </div></div>
  );

  return (
    <>
      <PageHeader crumbs={[['/stories', 'Stories'], [null, 'Share']]} title="Share a story"
        desc="Your journey, or a memory from school days. An admin reads every story before it goes live." />
      <form className="wrap form" onSubmit={submit}>
        <section className="card card-pad form-card form-one">
          <div className="form-grid">
            <Field label="Your story" hint={`${f.body.length}/10000 · leave a blank line between paragraphs`} wide required>
              <textarea className="input textarea story-input" required maxLength={10000} rows="10" value={f.body} onChange={set('body')} />
            </Field>
            <div className="wide share-row">
              <Field label="Your student ID" required>
                <input className="input num" required inputMode="numeric" pattern="[0-9]{6,9}" title="Your student ID, e.g. 201403005" maxLength={9}
                  placeholder="e.g. 201403005" value={f.studentId} onChange={set('studentId')} />
              </Field>
              <div className="photo-pick share-photo">
                {photo && <img className="story-thumb" src={photo.url} alt="" />}
                <label className="btn btn-secondary">
                  <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
                  {photo ? 'Change photo' : 'Add a photo'}
                </label>
                {photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>Remove</button>}
              </div>
            </div>
            {student ? <p className="wide admin-who"><Avatar person={student} size="sm" /><span><b>{student.name || 'Name not added yet'}</b> · Batch {student.batch} · {student.group}</span></p>
              : student === false ? <p className="wide admin-who err">No student with this ID.</p> : null}
          </div>
          {/* honeypot: hidden from people, bots fill it in */}
          <input className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} />
        </section>
        <div className="form-submit">
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send for review'}</button>
        </div>
      </form>
    </>
  );
}
