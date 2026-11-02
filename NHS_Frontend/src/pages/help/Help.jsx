import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAlumnusRaw, sendHelp } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Field } from '../../components/form/Field.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { currentId } from '../../lib/format.js';
import { useTitle } from '../../lib/hooks.js';

/** /help: a student reports a problem under their student ID; it lands in the admin's notifications (same as Help on a profile). */
export default function Help() {
  useTitle('Help & support');
  const [f, setF] = useState({ studentId: '', message: '', contact: '' });
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
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (student === false) return setError('No student with this ID. Check your student ID.');
    setBusy(true); setError(null);
    try {
      await sendHelp(currentId(+f.studentId.trim()), { message: f.message, contact: f.contact });
      setSent(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (sent) return (
    <div className="wrap section"><div className="card">
      <Empty icon="inbox" title="Request sent" action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
        The admin has been notified and will look into it soon.
      </Empty>
    </div></div>
  );

  return (
    <>
      <PageHeader crumbs={[[null, 'Help']]} title="Help & support"
        desc="Something wrong with your profile, or a problem with the site? Tell the admin here." />
      <form className="wrap form" onSubmit={submit}>
        <section className="card card-pad form-card form-one">
          <div className="form-grid">
            <Field label="Your student ID" required wide>
              <input className="input num" required inputMode="numeric" pattern="[0-9]{6,9}" title="Your student ID, e.g. 201403005" maxLength={9}
                placeholder="e.g. 201403005" value={f.studentId} onChange={set('studentId')} />
            </Field>
            {student ? <p className="wide admin-who"><Avatar person={student} size="sm" /><span><b>{student.name || 'Name not added yet'}</b> · Batch {student.batch} · {student.group}</span></p>
              : student === false ? <p className="wide admin-who err">No student with this ID.</p> : null}
            <Field label="Describe the problem" hint={`${f.message.length}/1000`} wide required>
              <textarea className="input textarea" required maxLength={1000} rows="5" value={f.message} onChange={set('message')}
                placeholder="e.g. My name is spelled wrong. It should be …" />
            </Field>
            <Field label="Phone or email" hint="optional, so the admin can reach you" wide>
              <input className="input" maxLength={120} autoComplete="email" value={f.contact} onChange={set('contact')} />
            </Field>
          </div>
        </section>
        <div className="form-submit">
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to admin'}</button>
        </div>
      </form>
    </>
  );
}
