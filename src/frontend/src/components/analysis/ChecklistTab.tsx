import { CheckmarkCircle24Filled, DismissCircle24Filled } from '@fluentui/react-icons';
import type { ChecklistItem } from '../../types';

interface ChecklistTabProps {
  items: ChecklistItem[];
}

export function ChecklistTab({ items }: ChecklistTabProps) {
  return (
    <div className="tab-panel">
      {items.map((item, i) => (
        <div key={i} className={`checklist-row ${item.present ? 'present' : 'missing'}`}>
          <span className="checklist-icon">
            {item.present ? <CheckmarkCircle24Filled /> : <DismissCircle24Filled />}
          </span>
          <span className="checklist-text">{item.item}</span>
        </div>
      ))}
    </div>
  );
}
