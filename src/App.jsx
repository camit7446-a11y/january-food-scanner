import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import ScanTab from './components/ScanTab.jsx';
import SearchTab from './components/SearchTab.jsx';
import CreditsBadge from './components/CreditsBadge.jsx';

const TABS = [
  { id: 'scan', label: 'Scan a meal' },
  { id: 'search', label: 'Look up a food' },
];

export default function App() {
  const [tab, setTab] = useState('scan');
  const [credits, setCredits] = useState(null);
  const [creditsError, setCreditsError] = useState(null);

  const refreshCredits = useCallback(async () => {
    try {
      setCredits(await api.credits());
      setCreditsError(null);
    } catch (e) {
      setCreditsError(e);
    }
  }, []);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Meal scanner</h1>
          <p className="tag">Photograph a plate. Get calories and macros from January AI.</p>
        </div>
        <CreditsBadge credits={credits} error={creditsError} onRefresh={refreshCredits} />
      </header>

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'tab tab-on' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main>
        <div role="tabpanel" id="panel-scan" aria-labelledby="tab-scan" hidden={tab !== 'scan'}>
          <ScanTab onUsedCredits={refreshCredits} />
        </div>
        <div role="tabpanel" id="panel-search" aria-labelledby="tab-search" hidden={tab !== 'search'}>
          <SearchTab onUsedCredits={refreshCredits} />
        </div>
      </main>

      <footer className="foot">
        Values are estimates from a photo. Check portions, and talk to a health professional before making medical decisions.
      </footer>
    </div>
  );
}
