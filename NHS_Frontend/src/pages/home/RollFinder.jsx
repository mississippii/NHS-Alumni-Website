import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { findByRoll } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';
import { studentId } from '../../lib/format.js';
import { GROUPS, ROLL_CHECK_FROM } from '../../lib/school.js';

/** SSC 2022 on: the school only has rolls, so students find their own record by batch, group and roll. */
export default function RollFinder({ firstRecord }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [f, setF] = useState({ batch: '', group: '', roll: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const years = Array.from({ length: new Date().getFullYear() - ROLL_CHECK_FROM + 1 }, (_, i) => ROLL_CHECK_FROM + i).reverse();
  const set = k => e => setF({ ...f, [k]: k === 'roll' ? e.target.value.replace(/\D/g, '') : e.target.value });

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { id } = await findByRoll(f.batch, f.group, f.roll);
      navigate(`/alumni/${studentId(id)}/update`, { state: { roll: f.roll } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="wrap">
        <div className="card roll-band">
          <div className="roll-part">
            <span className="pin-icon"><Icon name="idcard" /></span>
            <div>
              <h2>SSC {ROLL_CHECK_FROM}–{years[0]}</h2>
              <p className="text-2">Claim your profile with your SSC roll.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => ref.current.showModal()}>Find profile</button>
          </div>
          {/* the school's sheets start at firstRecord: older batches join by form, and an admin checks each request */}
          <div className="roll-part">
            <span className="pin-icon"><Icon name="users" /></span>
            <div>
              <h2>SSC 1958–{(firstRecord || 2006) - 1}</h2>
              <p className="text-2">Join the network, verified by an admin.</p>
            </div>
            <Link className="btn btn-accent" to="/join">Join</Link>
          </div>
        </div>
      </div>
      <dialog ref={ref} className="pin-dialog roll-dialog" aria-labelledby="roll-title">
        <form onSubmit={submit}>
          <span className="pin-icon"><Icon name="idcard" /></span>
          <h2 id="roll-title">Find your profile</h2>
          <p className="text-2">Use the details on your SSC admit card.</p>
          <label className="field">
            <span className="field-label">Batch (SSC year)</span>
            <select className="select" required value={f.batch} onChange={set('batch')}>
              <option value="" disabled>Choose batch</option>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Group</span>
            <select className="select" required value={f.group} onChange={set('group')} disabled={!f.batch}>
              <option value="" disabled>Choose group</option>
              {GROUPS.map(g => <option key={g.name}>{g.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">SSC roll</span>
            <input className="input num" required inputMode="numeric" pattern="[0-9]{4,10}" maxLength={10} autoComplete="off"
              disabled={!f.group} value={f.roll} onChange={set('roll')} />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Cancel</button>
        </form>
      </dialog>
    </section>
  );
}
