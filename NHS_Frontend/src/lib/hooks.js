import { useEffect, useState } from 'react';
import { SCHOOL } from './school.js';

/** Fetch-on-deps hook with loading + error state. */
export function useAsync(fn, deps) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    set(s => ({ ...s, loading: true, error: null }));
    fn().then(data => live && set({ data, error: null, loading: false }),
      error => live && set({ data: null, error, loading: false }));
    return () => { live = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Sets the browser tab title for the current page. */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SCHOOL.name} Alumni` : `${SCHOOL.name} Alumni`;
  }, [title]);
}
