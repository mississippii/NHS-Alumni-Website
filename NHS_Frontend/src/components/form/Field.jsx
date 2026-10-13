export function Field({ label, hint, children, wide, required }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label"><span>{label}{required && <span className="req" aria-hidden="true"> *</span>}</span>{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}
