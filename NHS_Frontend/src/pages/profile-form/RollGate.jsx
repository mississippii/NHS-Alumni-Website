import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkRoll } from '../../api/public.js';
import { Field } from '../../components/form/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { fullName, studentId } from '../../lib/format.js';

/** Step 0 for batches from the board's result sheets: prove it's you with your SSC roll, then the usual form opens. */
export default function RollGate({ id, person }) {
  const navigate = useNavigate();
  const [roll, setRoll] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const check = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      // the roll may belong to another profile of this batch: the form opens for that one
      const r = await checkRoll(id, roll.trim());
      navigate(`/alumni/${studentId(r.id)}/update`, { replace: true, state: { roll: roll.trim(), moved: r.id !== id ? id : null } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <>
      <header className="page-header">
        <div className="wrap form-head">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to={`/directory?batch=${person.batch}`}>Batch {person.batch}</Link><Icon name="chevron" />
            <Link to={`/alumni/${studentId(id)}`}>{fullName(person)}</Link>
          </nav>
          <h1 className="page-title">Update my profile</h1>
          <p className="page-desc">Student ID {studentId(id)} · Batch {person.batch} · {person.group}</p>
        </div>
      </header>
      <form className="wrap form" onSubmit={check}>
        <section className="card card-pad form-card roll-gate">
          <Field label="Your SSC roll" hint={`From your SSC ${person.batch} admit card`} required>
            <input className="input num" required inputMode="numeric" pattern="[0-9]{4,10}" maxLength={10} autoComplete="off"
              value={roll} onChange={e => setRoll(e.target.value.replace(/\D/g, ''))} autoFocus />
          </Field>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
        </section>
      </form>
    </>
  );
}
