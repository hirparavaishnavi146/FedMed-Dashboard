import { Suspense, lazy } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { LoadingState } from './components/States';

// Pages are loaded on demand, so each becomes its own JavaScript chunk. The
// first screen does not have to download the charting library used by the
// other four pages.
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const StartPage = lazy(() =>
  import('./pages/StartPage').then((module) => ({ default: module.StartPage })),
);
const TrainingPage = lazy(() =>
  import('./pages/TrainingPage').then((module) => ({ default: module.TrainingPage })),
);
const HospitalsPage = lazy(() =>
  import('./pages/HospitalsPage').then((module) => ({ default: module.HospitalsPage })),
);
const DatasetsPage = lazy(() =>
  import('./pages/DatasetsPage').then((module) => ({ default: module.DatasetsPage })),
);
const CaseIntakePage = lazy(() =>
  import('./pages/CaseIntakePage').then((module) => ({ default: module.CaseIntakePage })),
);
const MedicalReportAnalysisPage = lazy(() =>
  import('./pages/MedicalReportAnalysisPage').then((module) => ({
    default: module.MedicalReportAnalysisPage,
  })),
);
const ModelResultsPage = lazy(() =>
  import('./pages/ModelResultsPage').then((module) => ({ default: module.ModelResultsPage })),
);
const PrivacySecurityPage = lazy(() =>
  import('./pages/PrivacySecurityPage').then((module) => ({ default: module.PrivacySecurityPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

/**
 * Which router to use.
 *
 * Clean paths (/medical-reports) are the default and are what the API host uses, since
 * it serves the app with a fallback to index.html for any client-side route.
 *
 * A purely static host has no such fallback: it answers an unknown path with its own
 * 404 page, so a refresh on /medical-reports breaks even though in-app navigation
 * works. Hash routing keeps the route after "#", which the server never sees, so every
 * route resolves. It is opt-in (VITE_HASH_ROUTER=true) rather than automatic, because
 * it changes the shape of every URL and should be a deliberate choice per deployment.
 */
const USE_HASH_ROUTER = import.meta.env.VITE_HASH_ROUTER === 'true';

const Router = USE_HASH_ROUTER ? HashRouter : BrowserRouter;

/**
 * Routes for the five dashboard pages. The legacy "/privacy" path redirects to
 * the canonical one so old links keep working.
 */
export default function App(): React.JSX.Element {
  return (
    <Router basename={USE_HASH_ROUTER ? undefined : import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<LoadingState label="Loading" />}>
                <StartPage />
              </Suspense>
            }
          />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<LoadingState label="Loading dashboard" />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="training"
            element={
              <Suspense fallback={<LoadingState label="Loading training page" />}>
                <TrainingPage />
              </Suspense>
            }
          />
          <Route
            path="hospitals"
            element={
              <Suspense fallback={<LoadingState label="Loading hospitals page" />}>
                <HospitalsPage />
              </Suspense>
            }
          />
          <Route
            path="datasets"
            element={
              <Suspense fallback={<LoadingState label="Loading datasets page" />}>
                <DatasetsPage />
              </Suspense>
            }
          />
          <Route
            path="case-intake"
            element={
              <Suspense fallback={<LoadingState label="Loading case intake" />}>
                <CaseIntakePage />
              </Suspense>
            }
          />
          <Route
            path="medical-reports"
            element={
              <Suspense fallback={<LoadingState label="Loading medical report analysis" />}>
                <MedicalReportAnalysisPage />
              </Suspense>
            }
          />
          <Route
            path="model-results"
            element={
              <Suspense fallback={<LoadingState label="Loading model results" />}>
                <ModelResultsPage />
              </Suspense>
            }
          />
          <Route
            path="privacy-security"
            element={
              <Suspense fallback={<LoadingState label="Loading privacy page" />}>
                <PrivacySecurityPage />
              </Suspense>
            }
          />
          <Route path="privacy" element={<Navigate to="/privacy-security" replace />} />
          <Route
            path="*"
            element={
              <Suspense fallback={<LoadingState label="Loading" />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
