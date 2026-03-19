/**
 * ImprovementPlanCard.
 *
 * Sidebar card showing prioritized actionable improvement items
 * with impact tags.
 */

import { type ImprovementItem } from './homepageDemoData';

interface ImprovementPlanCardProps {
  items: ImprovementItem[];
}

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-yellow-500/15 text-yellow-400',
  low: 'bg-blue-500/15 text-blue-400',
};

const TAG_COLORS: Record<string, string> = {
  Layout: 'bg-blue-500/15 text-blue-400',
  Constraints: 'bg-purple-500/15 text-purple-400',
  Timing: 'bg-cyan-500/15 text-cyan-400',
  Practice: 'bg-green-500/15 text-green-400',
  Ergonomics: 'bg-orange-500/15 text-orange-400',
};

export function ImprovementPlanCard({ items }: ImprovementPlanCardProps) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Improvement Plan</h3>
        <div className="flex gap-2 text-[10px]">
          <span className="text-gray-400 border-b border-gray-400 cursor-pointer">Priority</span>
          <span className="text-gray-600 cursor-pointer">Estimated impact tags</span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2">
            {/* Checkbox */}
            <div className="mt-0.5 flex-shrink-0">
              <div
                className={`w-3.5 h-3.5 rounded-sm border ${
                  item.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-600'
                }`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-xs ${item.completed ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                {item.text}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className={`text-[9px] px-1 py-0.5 rounded ${IMPACT_COLORS[item.impact]}`}>
                  {item.impact === 'high' ? 'Priority' : item.impact === 'medium' ? 'Priority' : 'Priority'}
                </span>
                {item.tags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[9px] px-1 py-0.5 rounded ${TAG_COLORS[tag] ?? 'bg-gray-500/15 text-gray-400'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
