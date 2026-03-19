/**
 * SuggestedSimilaritiesCard.
 *
 * Sidebar card showing performances with similar rhythmic
 * or ergonomic structure.
 */

import { Music, LayoutGrid } from 'lucide-react';
import { type SimilarityItem } from './homepageDemoData';

interface SuggestedSimilaritiesCardProps {
  items: SimilarityItem[];
}

const ICONS: Record<string, React.ReactNode> = {
  rhythm: <Music size={14} className="text-cyan-400" />,
  layout: <LayoutGrid size={14} className="text-purple-400" />,
};

export function SuggestedSimilaritiesCard({ items }: SuggestedSimilaritiesCardProps) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Suggested Similarities</h3>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex gap-2.5">
            <div className="flex-shrink-0 mt-0.5">
              {ICONS[item.icon] ?? ICONS.rhythm}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-300">{item.title}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
