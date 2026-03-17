/**
 * Validator Scenario Panel (left panel).
 *
 * Dropdown to select a scenario, description text, constraint tags,
 * and a reset button.
 */

import { type ValidatorScenario } from './types';

interface Props {
  scenarios: ValidatorScenario[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReset: () => void;
  isDirty: boolean;
}

export function ValidatorScenarioPanel({
  scenarios,
  selectedId,
  onSelect,
  onReset,
  isDirty,
}: Props) {
  const selected = scenarios.find(s => s.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Scenario
      </h2>

      {/* Dropdown */}
      <select
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
      >
        {scenarios.map(s => (
          <option key={s.id} value={s.id}>
            {s.id}: {s.title}
          </option>
        ))}
      </select>

      {/* Description */}
      {selected && (
        <div className="text-xs text-gray-400 leading-relaxed">
          {selected.description}
        </div>
      )}

      {/* Constraint Tags */}
      {selected && (
        <div className="flex flex-wrap gap-1.5">
          {selected.constraintIds.map(c => (
            <span
              key={c}
              className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30"
            >
              {c}
            </span>
          ))}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              selected.expectedInitialStatus === 'violation'
                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                : 'bg-green-500/20 text-green-300 border-green-500/30'
            }`}
          >
            expects: {selected.expectedInitialStatus}
          </span>
        </div>
      )}

      {/* Fix hint */}
      {selected?.fixHint && (
        <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 leading-relaxed">
          {selected.fixHint}
        </div>
      )}

      {/* Reset button */}
      {isDirty && (
        <button
          onClick={onReset}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded transition-colors"
        >
          Reset to Original
        </button>
      )}
    </div>
  );
}
