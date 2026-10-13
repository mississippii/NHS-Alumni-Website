/* ---------- brand logos (Facebook, X, YouTube paths: Simple Icons, CC0; LinkedIn drawn here) ---------- */
export const SOCIAL = {
  facebook: { label: 'Facebook', color: '#0866FF', svg: <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" /> },
  linkedin: {
    label: 'LinkedIn', color: '#0A66C2',
    svg: <><rect x="1" y="1" width="22" height="22" rx="4" /><g fill="#fff"><circle cx="6.6" cy="6.7" r="1.7" /><rect x="5.1" y="9.4" width="3" height="9.4" rx=".3" /><path d="M10.4 9.4h2.9v1.3c.5-.8 1.5-1.5 3-1.5 2.8 0 3.4 1.8 3.4 4.2v5.4h-3v-4.8c0-1.1-.1-2.5-1.6-2.5s-1.8 1.2-1.8 2.4v4.9h-2.9z" /></g></>,
  },
  youtube: { label: 'YouTube', color: '#FF0000', svg: <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /> },
  twitter: { label: 'X (Twitter)', color: 'var(--text)', svg: <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" /> },
};

/** Round brand-logo buttons for a student's social profiles. */
export function SocialLinks({ links, name }) {
  if (!links?.length) return null;
  return (
    <div className="socials">
      {links.map(l => {
        const s = SOCIAL[l.type];
        return s && (
          <a key={l.type} className={`social social-${l.type}`} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
            aria-label={`${name} on ${s.label}`} title={s.label} style={{ '--brand-c': s.color }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{s.svg}</svg>
          </a>
        );
      })}
    </div>
  );
}
