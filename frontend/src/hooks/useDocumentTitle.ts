// Keeps the browser tab title in step with the current page, and marks the tab
// as DEMO while the app is running on sample data. The badge disappears on its
// own once VITE_USE_DEMO_DATA=false and the real backend is in use.

import { useEffect } from 'react';
import { IS_DEMO_MODE } from '../services/api';

const APP_NAME = 'FedMed';

export function useDocumentTitle(pageLabel: string | undefined): void {
  useEffect(() => {
    const badge = IS_DEMO_MODE ? '[DEMO] ' : '';
    document.title = pageLabel
      ? `${badge}${pageLabel} | ${APP_NAME}`
      : `${badge}${APP_NAME}`;
  }, [pageLabel]);
}
