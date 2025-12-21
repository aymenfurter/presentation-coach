interface AnalysisTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = ['overview', 'checklist', 'segments', 'slides'] as const;

export function AnalysisTabs({ activeTab, onTabChange }: AnalysisTabsProps) {
  return (
    <div className="analysis-tabs-compact">
      {TABS.map(tab => (
        <button 
          key={tab}
          className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
