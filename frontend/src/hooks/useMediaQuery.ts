// Tracks a CSS media query in React state, used to decide when the sidebar
// becomes an off-canvas drawer on tablet and mobile.

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True below the tablet breakpoint, where the sidebar is a drawer. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 900px)');
}
