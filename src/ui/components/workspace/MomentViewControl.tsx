/**
 * The moment view's control (S4.2, T09): Now | Now + Next | Prev · Now · Next.
 * One segmented control of toggle buttons (aria-pressed) in the grid's dock
 * replaces the onion-skin toggle that sat in the Events tab and the Arrows
 * toggle in the view settings. O cycles it (the input table's moment-view
 * row). The choice is remembered per viewer, with the other view settings.
 */

import { useInputHandler } from '../../input/inputRegistry';
import { MOMENT_VIEWS, nextMomentView, useViewSettings } from '../../state/viewSettings';
import { ToggleButton } from '../shared/ToggleButton';

export function MomentViewControl() {
  const { settings, setMomentView } = useViewSettings();
  useInputHandler('moment-view', () => {
    setMomentView(nextMomentView(settings.momentView));
  });
  return (
    <div role="group" aria-label="Moment view" data-testid="moment-view" className="flex items-center">
      {MOMENT_VIEWS.map((view, i) => (
        <ToggleButton
          key={view.id}
          size="sm"
          pressed={settings.momentView === view.id}
          onPressedChange={() => setMomentView(view.id)}
          label={view.label}
          title={`${view.description} (O cycles the views)`}
          testId={`moment-view-${view.id}`}
          className={`${i > 0 ? '-ml-px rounded-l-none' : ''} ${i < MOMENT_VIEWS.length - 1 ? 'rounded-r-none' : ''}`}
        />
      ))}
    </div>
  );
}
