import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findByRoll } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';
import { studentId } from '../../lib/format.js';
import { FOUNDED, GROUPS, ROLL_CHECK_FROM, THIS_YEAR } from '../../lib/school.js';

const YEARS = Array.from({ length: THIS_YEAR - FOUNDED + 1 }, (_, i) => THIS_YEAR - i);

/**
 * One "Join" for every batch. Pick the batch first; then
 *   up to lastJoin (not in the school's sheets): the join form, checked by an admin;
 *   ROLL_CHECK_FROM on (sheets have rolls only): group + SSC roll finds the record;
 *   in between (sheets have names): the batch page, filtered to that group, to find yourself.
 */
export default function JoinFinder({ firstRecord }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const lastJoin = (firstRecord ?? 2006) - 1;
  const [f, setF] = useState({ batch: '', group: '', roll: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const year = YEARS.includes(+f.batch) ? +f.batch : null;
  const kind = !year ? null : year <= lastJoin ? 'form' : year >= ROLL_CHECK_FROM ? 'roll' : 'list';
  const set = k => e => {
    const v = k === 'roll' || k === 'batch' ? e.target.value.replace(/\D/g, '') : e.target.value;
    setError(null);
    setF(s => (k === 'batch' ? { batch: v, group: '', roll: '' } : { ...s, [k]: v }));
  };

  // a department button: straight to the batch page for names, else on to the SSC roll
  const pickGroup = g => (kind === 'list' ? navigate(`/directory?batch=${year}&group=${encodeURIComponent(g)}`) : setF(s => ({ ...s, group: g })));

  const submit = async e => {
    e.preventDefault();
    if (kind === 'form') return navigate('/join', { state: { batch: year } });
    setBusy(true); setError(null);
    try {
      const { id } = await findByRoll(year, f.group, f.roll);
      navigate(`/alumni/${studentId(id)}/update`, { state: { roll: f.roll } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="wrap">
        <div className="card join-band">
          <span className="pin-icon"><Icon name="users" /></span>
          <div>
            <h2>Join the network</h2>
            <p className="text-2">SSC {FOUNDED}–{THIS_YEAR}: find your profile, or add yourself.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => ref.current.showModal()}>Join</button>
        </div>
      </div>
      <dialog ref={ref} className="pin-dialog roll-dialog" aria-labelledby="join-title">
        <form onSubmit={submit}>
          <h2 id="join-title">Join the network</h2>
          <label className="field">
            <span className="field-label">Batch (SSC year)</span>
            <input className="input num" list="join-years" required inputMode="numeric" maxLength={4} autoComplete="off"
              placeholder="Type or choose, e.g. 2014" value={f.batch} onChange={set('batch')} />
            <datalist id="join-years">{YEARS.map(y => <option key={y} value={y} />)}</datalist>
          </label>
          {f.batch.length === 4 && !year && <p className="err">Choose a year from {FOUNDED} to {THIS_YEAR}.</p>}

          {(kind === 'roll' || kind === 'list') && (
            <fieldset className="field join-groups">
              <legend className="field-label">Department</legend>
              <div>
                {GROUPS.map(g => (
                  <button key={g.name} type="button" className="btn btn-secondary" aria-pressed={f.group === g.name} onClick={() => pickGroup(g.name)}>
                    <i className={`dot ${g.cls}`} aria-hidden="true" />{g.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {kind === 'roll' && f.group && (
            <label className="field">
              <span className="field-label">SSC roll</span>
              <input className="input num" required inputMode="numeric" pattern="[0-9]{4,10}" maxLength={10} autoComplete="off"
                value={f.roll} onChange={set('roll')} />
            </label>
          )}

          {error && <p className="err" role="alert">{error}</p>}
          {kind === 'form' && <p className="text-2">Batches before {lastJoin + 1} aren’t in the school’s records: fill in the form and an admin checks it.</p>}
          {(kind === 'form' || (kind === 'roll' && f.group)) && (
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Cancel</button>
        </form>
      </dialog>
    </section>
  );
}
