import { useState } from 'react';
import { api, explainError } from '../api.js';
import { listFromSearch, toMap, pick, fmt, servingText } from '../format.js';

export default function SearchTab({ onUsedCredits }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('idle');
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  async function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setStatus('loading');
    setError('');
    try {
      const data = await api.searchFoods(q, type);
      setFoods(listFromSearch(data));
      setSearched(q);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(explainError(err));
    } finally {
      onUsedCredits();
    }
  }

  return (
    <div className="search">
      <form onSubmit={submit} className="search-form">
        <label className="field grow">
          <span>Food name</span>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Greek yogurt" maxLength={256} />
        </label>
        <label className="field">
          <span>Kind</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="generic">Generic foods</option>
            <option value="branded">Branded products</option>
            <option value="recipe">Recipes</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={!query.trim() || status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Search foods'}
        </button>
      </form>
      <p className="hint">Each search uses 2 January credits.</p>

      {error && <p className="notice notice-error">{error}</p>}
      {status === 'done' && foods.length === 0 && <p className="notice">No foods found for “{searched}”. Try a simpler name.</p>}

      <ul className="results">
        {foods.map((f, i) => {
          const kcal = pick(toMap(f.nutrients), ['calories', 'energy', 'kcal']);
          return (
            <li key={`${f.id ?? 'f'}-${i}`}>
              <div className="food-top">
                <strong>{f.name}</strong>
                <span>{kcal ? fmt(kcal.value) : ''}</span>
              </div>
              <div className="food-meta">{[f.brand, f.type, servingText(f) && `per ${servingText(f)}`].filter(Boolean).join(', ')}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
