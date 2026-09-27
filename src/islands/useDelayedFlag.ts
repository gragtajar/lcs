import { useEffect, useState } from 'preact/hooks';

/**
 * `flag`, but only once it has stayed true for `ms`. The search surfaces use it
 * for their loading state: a search that answers quickly shows nothing, and one
 * that is slow (the index still downloading, a slow phone, a slow network)
 * shows a spinner rather than a field that seems to ignore the reader.
 */
export function useDelayedFlag(flag: boolean, ms: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!flag) {
      setOn(false);
      return;
    }
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [flag, ms]);
  return on;
}
