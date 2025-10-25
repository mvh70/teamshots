'use client'

type Tab = {
  key: string
  label: string
  count?: number
}

export default function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`${isActive ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium`}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{tab.count}</span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}


