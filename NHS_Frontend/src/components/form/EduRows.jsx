import { Icon } from '../Icon.jsx';
import { Field } from './Field.jsx';

const EDU_TYPES = ['College', 'University'];
export const blankEdu = level => ({ level, institution: '' });
// older rows were saved as HSC / Bachelor's / …
export const eduType = level => (!level || /hsc|college/i.test(level) ? 'College' : 'University');
/** College / university rows (shared with the admin's memorial form). */
export function EduRows({ edu, setEdu }) {
  const setRow = (i, k) => e => setEdu(rows => rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  return (
    <>
      <ol className="edu-rows">
        {edu.map((r, i) => (
          <li key={i} className="edu-row">
            <Field label="Type">
              <select className="select" required value={r.level} onChange={setRow(i, 'level')}>
                {EDU_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="College / University after SSC">
              <input className="input" placeholder={`${r.level} name`} value={r.institution} onChange={setRow(i, 'institution')} />
            </Field>
            {edu.length > 1 && (
              <button type="button" className="btn btn-ghost edu-remove" onClick={() => setEdu(rows => rows.filter((_, j) => j !== i))} aria-label={`Remove institution ${i + 1}`}>
                <Icon name="x" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {edu.length < 10 && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdu(rows => [...rows, blankEdu('University')])}>+ Add another</button>
      )}
    </>
  );
}
