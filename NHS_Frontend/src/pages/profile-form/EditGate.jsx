import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkUnlock, unlockProfile } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';
import { fullName, studentId } from '../../lib/format.js';
import PinDialog from './PinDialog.jsx';

/** "Edit profile" on a claimed profile: a PIN goes to the saved email at once; right PIN = the form opens, ready to save. */
export default function EditGate({ id, person, onUnlock }) {
  const [email, setEmail] = useState(null); // masked, once the server answers
  const [open, setOpen] = useState(true); // the PIN box shows at once, while the mail is sent
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async () => {
    setBusy(true); setError(null); setOpen(true);
    try { setEmail((await unlockProfile(id)).email); } catch (err) { setError(err.message); setOpen(false); } finally { setBusy(false); }
  };
  const sent = useRef(false); // once per visit (dev StrictMode runs effects twice)
  useEffect(() => { if (!sent.current) { sent.current = true; send(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ponytail: the PIN saves for 1 hour after this; past that, Save fails and the student starts over
  const confirm = async pin => onUnlock({ ...(await checkUnlock(id, pin)), id, pin });
  return (
    <>
      <header className="page-header">
        <div className="wrap form-head">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to={`/directory?batch=${person.batch}`}>Batch {person.batch}</Link><Icon name="chevron" />
            <Link to={`/alumni/${studentId(id)}`}>{fullName(person)}</Link>
          </nav>
          <h1 className="page-title">Edit profile</h1>
          <p className="page-desc">Student ID {studentId(id)} · Batch {person.batch} · {person.group}</p>
        </div>
      </header>
      <div className="wrap form">
        <section className="card card-pad form-card roll-gate">
          <p className="text-2">To keep your profile safe, we email a 6-digit PIN to the address saved on it.</p>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="button" onClick={send} disabled={busy}>{busy ? 'Sending PIN…' : 'Send PIN again'}</button>
          <p className="form-note">No access to that email? Go back and tap ⋮ → Help.</p>
        </section>
      </div>
      {open && <PinDialog email={email || 'your saved email'} busyText="Checking…" closeLabel="Cancel" onClose={() => setOpen(false)}
        onResend={() => unlockProfile(id)} onConfirm={confirm} />}
    </>
  );
}
