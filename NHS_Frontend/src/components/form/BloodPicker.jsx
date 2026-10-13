import { useRef } from 'react';
import { BLOOD_GROUPS } from '../../lib/school.js';

/** Blood group: a button that opens a bottom sheet of big tap targets, like the phone code picker. */
export function BloodPicker({ value, onChange }) {
  const ref = useRef(null);
  const pick = v => { onChange(v); ref.current.close(); };
  // sits inside a <label>: taps on the sheet's padding re-click this button, so ignore them while open
  const open = () => !ref.current.open && ref.current.showModal();

  return (
    <>
      <button type="button" className="cc-pick pick-wide" aria-label={`Blood group ${value || 'not set'}, change`} onClick={open}>
        <span className={value ? '' : 'text-3'}>{value || 'Not set'}</span>
      </button>
      <dialog ref={ref} className="pin-dialog code-dialog" aria-label="Choose blood group">
        <div className="code-sheet">
          <div className="blood-grid">
            {BLOOD_GROUPS.map(b => (
              <button key={b} type="button" className="btn btn-secondary" aria-current={b === value || undefined} onClick={() => pick(b)}>{b}</button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick('')}>Not set</button>
        </div>
      </dialog>
    </>
  );
}
