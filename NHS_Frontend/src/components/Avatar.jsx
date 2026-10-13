import { initials, tint } from '../lib/format.js';

export function Avatar({ person, size = '' }) {
  return (
    <span className={`avatar ${size && `avatar-${size}`} ${person.photo ? '' : tint(person.group)}`} aria-hidden="true">
      {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : initials(person.name)}
    </span>
  );
}
