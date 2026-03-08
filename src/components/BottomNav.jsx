import { Button } from "./ui";

export function BottomNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="tab-bar-mobile surface rounded-3xl p-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <Button
            key={tab.id}
            className={`tab-button ${isActive ? `tab-button-active ${tab.id}-accent` : "bg-white text-black"}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-icon-wrap"><Icon className="h-5 w-5" /></span>
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
