import { useState, type ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div className="bg-surface rounded-lg shadow border border-border">
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
