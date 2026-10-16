// Shown for any URL that does not match one of the five pages.

import { Link, useLocation } from 'react-router-dom';
import { Card, PageHeader } from '../components/Card';
import { EmptyState } from '../components/States';

export function NotFoundPage(): React.JSX.Element {
  const location = useLocation();
  return (
    <div className="page">
      <PageHeader
        title="Page not found"
        description="The address you opened does not match any page in the FedMed dashboard."
      />
      <Card>
        <EmptyState
          title="Nothing at this address"
          description={`No page is registered for ${location.pathname}. Use the navigation to pick one of the five dashboard pages.`}
          icon="search"
          action={<Link className="btn btn--primary btn--md" to="/">Back to the start</Link>}
        />
      </Card>
    </div>
  );
}
