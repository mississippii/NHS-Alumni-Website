import { useRef, useState } from 'react';
import { DIAL_CODES } from '../../lib/countries.js';

/** Phone country code: a flag + code button that opens a searchable list (type a country name or digits). */
export function CodePicker({ value, onChange }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase().replace(/^\+/, '');
  const starts = c => c.name.toLowerCase().startsWith(term) || c.code.slice(1).startsWith(term);
  // names starting with the search come first ("sau" → Saudi Arabia before Guinea-Bissau)
  const hits = DIAL_CODES.filter(c => starts(c) || c.name.toLowerCase().includes(term)).sort((a, b) => starts(b) - starts(a));
  const pick = code => { onChange(code); ref.current.close(); };
  // sits inside the Phone <label>: taps on the sheet's padding re-click this button, so ignore them while open
  const open = () => { if (ref.current.open) return; setQ(''); ref.current.showModal(); };

  return (
    <>
      <button type="button" className="cc-pick" aria-label={`Country code ${value}, change`} onClick={open}>
        {DIAL_CODES.find(c => c.code === value)?.flag} {value}
      </button>
      <dialog ref={ref} className="pin-dialog code-dialog" aria-label="Choose country code">
        {/* a div, not a form: this sits inside the profile form. Enter picks the top match. */}
        <div className="code-sheet">
          <input className="input" type="search" enterKeyHint="done"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) pick(hits[0].code); } }} autoFocus placeholder="Search country or code" aria-label="Search country"
            value={q} onChange={e => setQ(e.target.value)} />
          <ul className="code-list">
            {hits.map(c => (
              <li key={c.code}>
                <button type="button" aria-current={c.code === value || undefined} onClick={() => pick(c.code)}>
                  <span>{c.flag} {c.name}</span><span className="text-3">{c.code}</span>
                </button>
              </li>
            ))}
            {!hits.length && <li className="text-3 code-none">No country found</li>}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.close()}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}
