// Renders the real state of a security feature.
//
// The whole point of this component is that a feature's badge reflects what the API
// observed, never what a UI switch says. `enabled` appears only when the API reports
// the feature as implemented, configured and in effect.

import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';
import type { FeatureState } from '../types';

interface StatePresentation {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** What this state means, in one sentence, shown under the badge. */
  meaning: string;
}

/**
 * How each state reads to a person.
 *
 * `enabled` is deliberately the only success tone: everything else is a gap, and a
 * gap must not look like a pass.
 */
export const FEATURE_STATE_INFO: Record<FeatureState, StatePresentation> = {
  enabled: {
    label: 'Enabled',
    tone: 'success',
    meaning: 'Implemented, configured, and in effect for this running process.',
  },
  disabled: {
    label: 'Disabled',
    tone: 'neutral',
    meaning: 'Implemented, but turned off.',
  },
  unconfigured: {
    label: 'Not configured',
    tone: 'warning',
    meaning: 'Implemented, but needs configuration before it can do anything.',
  },
  unverified: {
    label: 'Unverified',
    tone: 'info',
    meaning:
      'Implemented and covered by tests, but not exercised in this process — so no claim is made that it is in effect.',
  },
  not_implemented: {
    label: 'Not implemented',
    tone: 'danger',
    meaning: 'No code exists for this. Nothing works.',
  },
};

export function FeatureStateBadge({ state }: { state: FeatureState }): React.JSX.Element {
  const presentation = FEATURE_STATE_INFO[state] ?? FEATURE_STATE_INFO.unconfigured;
  return <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>;
}

export interface FeatureStateCardProps {
  name: string;
  state: FeatureState;
  implemented: boolean;
  description: string;
  /** What was observed. Shown verbatim so the state is checkable. */
  evidence: string;
  requirements?: string[];
  reference?: string;
}

export function FeatureStateCard({
  name,
  state,
  implemented,
  description,
  evidence,
  requirements = [],
  reference,
}: FeatureStateCardProps): React.JSX.Element {
  const presentation = FEATURE_STATE_INFO[state] ?? FEATURE_STATE_INFO.unconfigured;

  return (
    <div className="feature-state" data-state={state} data-feature-implemented={implemented}>
      <div className="feature-state__head">
        <span className="feature-state__name">{name}</span>
        <FeatureStateBadge state={state} />
      </div>

      <p className="feature-state__description">{description}</p>

      <p className="feature-state__meaning">
        <Icon name="info" size={14} /> {presentation.meaning}
      </p>

      <div className="feature-state__evidence">
        <span className="feature-state__evidence-label">Observed</span>
        {evidence}
      </div>

      {requirements.length > 0 ? (
        <div className="feature-state__requirements">
          <span className="feature-state__evidence-label">To enable</span>
          <ul>
            {requirements.map((requirement) => (
              <li key={requirement}>
                <code>{requirement}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {reference ? <p className="feature-state__reference">{reference}</p> : null}
    </div>
  );
}
