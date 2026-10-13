import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAlumnus } from '../../api/public.js';
import { Icon } from '../../components/Icon.jsx';
import { currentId } from '../../lib/format.js';

/** "Who's replying?" popup: asks for the Student ID once, shows where to find it, and checks it belongs to someone. */
export default function StudentIdDialog({ onDone, onClose }) {
  const ref = useRef(null);
  const [sid, setSid] = useState('');
  const [state, setState] = useState(null); // null | 'busy' | error text
  useEffect(() => { ref.current.showModal(); }, []);
  const submit = async e => {
    e.preventDefault();
    setState('busy');
    try {
      const p = await getAlumnus(currentId(+sid));
      if (!p || !p.name || p.memorial) return setState('No student with that Student ID. Check your profile.');
      onDone({ id: p.id, name: p.name });
    } catch (err) {
      setState(err.message);
    }
  };
  return (
    <dialog ref={ref} className="pin-dialog" onClose={onClose} aria-labelledby="sid-title">
      <form onSubmit={submit}>
        <span className="pin-icon"><Icon name="idcard" /></span>
        <h2 id="sid-title">What’s your Student ID?</h2>
        <p className="text-2">Your reply shows with your name and photo.</p>
        <input className="input pin-input num" required autoFocus inputMode="numeric" pattern="\d{7,9}" maxLength={9}
          placeholder="201403005" aria-label="Student ID" value={sid} onChange={e => { setSid(e.target.value.replace(/\D/g, '')); setState(null); }} />
        <p className="sid-hint">
          <b>Where to find it:</b> open your profile. It’s under your name, next to <Icon name="idcard" /> <b>Student ID</b>.{' '}
          Don’t know your profile? <Link className="link" to="/alumni">Search your name</Link>.
        </p>
        {state && state !== 'busy' && <p className="err" role="alert">{state}</p>}
        <div className="btn-row">
          <button className="btn btn-ghost" type="button" onClick={() => ref.current.close()}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={state === 'busy' || sid.length < 7}>Continue</button>
        </div>
      </form>
    </dialog>
  );
}
