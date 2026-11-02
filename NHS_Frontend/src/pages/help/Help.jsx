import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAlumnusRaw, sendHelp } from '../../api/public.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Empty, PageHeader } from '../../components/page.jsx';
import { currentId } from '../../lib/format.js';
import { useTitle } from '../../lib/hooks.js';

/** /help: a student reports a problem under their student ID; it lands in the admin's notifications (same as Help on a profile). */
export default function Help() {
  useTitle('Help');
  const [f, setF] = useState({ studentId: '', message: '' });
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
    const id = currentId(+f.studentId.trim());
    setBusy(true); setError(null);
    try {
      // check the ID here too: the live lookup may not have finished if Submit was pressed quickly
      if (!(await getAlumnusRaw(id))) { setStudent(false); return; }
      await sendHelp(id, { message: f.message });
      setSent(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (sent) return (
    <div className="wrap section"><div className="card">
      <Empty icon="inbox" title="Request sent" action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
        The admin will look into it soon.
      </Empty>
    </div></div>
  );

  return (
    <>
      <PageHeader crumbs={[[null, 'Help']]} />
      <form className="wrap form help-form" onSubmit={submit}>
        <label className="outline-field">
          <textarea className="input textarea" required maxLength={1000} rows="5" value={f.message} onChange={set('message')} />
          <span>Problem<span className="req" aria-hidden="true"> *</span></span>
        </label>
        <div className="help-row">
          <label className="outline-field">
            <input className="input num" required inputMode="numeric" pattern="[0-9]{6,9}" title="Your student ID, e.g. 201403005" maxLength={9}
              value={f.studentId} onChange={set('studentId')} />
            <span>Student ID<span className="req" aria-hidden="true"> *</span></span>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit'}</button>
        </div>
        {student ? <p className="admin-who"><Avatar person={student} size="sm" /><span><b>{student.name || 'Name not added yet'}</b> · Batch {student.batch} · {student.group}</span></p>
          : student === false ? <p className="admin-who err">No student with this ID.</p> : null}
        {error && student !== false && <p className="err" role="alert">{error}</p>}
      </form>
    </>
  );
}
