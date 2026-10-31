import { toMap, read, fmt, pick, humanize, confidenceText, servingText, detectionsOf } from '../format.js';

const MACROS = [
  { label: 'Total fat', keys: ['fat', 'total_fat'] },
  { label: 'Carbohydrates', keys: ['carbohydrates', 'carbohydrate', 'carbs', 'total_carbohydrate'] },
  { label: 'Protein', keys: ['protein'] },
];
const SUBS = [
  { label: 'Fibre', keys: ['fiber', 'fibre', 'dietary_fiber'] },
  { label: 'Sugars', keys: ['sugar', 'sugars', 'total_sugars'] },
  { label: 'Sodium', keys: ['sodium'] },
];

/** Styled like a printed Nutrition Facts label. Shows an empty label until a result arrives. */
export default function NutritionPanel({ result, status, elapsed, error }) {
  const totals = toMap(result?.total_nutrients);
  const calories = pick(totals, ['calories', 'energy', 'kcal']);
  const shownKeys = new Set(calories ? [calories.key] : []);
  const detections = detectionsOf(result);

  const macroRows = MACROS.map((m) => ({ ...m, found: pick(totals, m.keys) }));
  const subRows = SUBS.map((m) => ({ ...m, found: pick(totals, m.keys) }));
  [...macroRows, ...subRows].forEach((r) => r.found && shownKeys.add(r.found.key));
  const others = Object.keys(totals).filter((k) => !shownKeys.has(k) && read(totals[k]));

  const loading = status === 'loading';
  const empty = !result;

  return (
    <section className="label" aria-live="polite" aria-busy={loading}>
      <h2 className="label-title">Nutrition Facts</h2>
      <p className="label-sub">
        {result?.meal_name || (loading ? 'Reading your meal…' : empty ? 'No meal scanned yet' : 'Scanned meal')}
      </p>
      <div className="rule rule-thick" />

      {loading && (
        <p className="label-note">
          Analysing the photo, {elapsed}s. Complex meals can take tens of seconds.
        </p>
      )}
      {error && !loading && <p className="label-note label-error">{error}</p>}
      {empty && !loading && !error && (
        <p className="label-note">Add a photo and choose Scan meal. The totals and each detected food will fill this label.</p>
      )}

      <div className="cal-row">
        <span className="cal-name">Calories</span>
        <span className="cal-value">{calories ? fmt(calories.value).replace(/\s?kcal$/i, '') : '–'}</span>
      </div>
      <div className="rule rule-medium" />

      {macroRows.map((r) => (
        <div className="row row-strong" key={r.label}>
          <span>{r.label}</span>
          <span>{fmt(r.found?.value)}</span>
        </div>
      ))}
      {subRows.map((r) => (
        <div className="row row-sub" key={r.label}>
          <span>{r.label}</span>
          <span>{fmt(r.found?.value)}</span>
        </div>
      ))}

      {others.length > 0 && (
        <details className="more">
          <summary>All {others.length} other nutrients</summary>
          {others.map((k) => (
            <div className="row row-sub" key={k}>
              <span>{humanize(k)}</span>
              <span>{fmt(read(totals[k]))}</span>
            </div>
          ))}
        </details>
      )}

      {detections.length > 0 && (
        <>
          <div className="rule rule-thick" />
          <h3 className="label-heading">What we found on the plate</h3>
          <ul className="foods">
            {detections.map((d, i) => {
              const n = toMap(d.food?.nutrients);
              const kcal = pick(n, ['calories', 'energy', 'kcal']);
              const protein = pick(n, ['protein']);
              const carbs = pick(n, MACROS[1].keys);
              const fat = pick(n, MACROS[0].keys);
              return (
                <li key={`${d.food?.id ?? 'x'}-${i}`}>
                  <div className="food-top">
                    <strong>{d.food?.name || 'Unnamed food'}</strong>
                    <span>{kcal ? fmt(kcal.value) : ''}</span>
                  </div>
                  <div className="food-meta">
                    {[servingText(d.food), confidenceText(d.confidence_score)].filter(Boolean).join(', ')}
                  </div>
                  <div className="food-meta">
                    {[
                      protein && `Protein ${fmt(protein.value)}`,
                      carbs && `Carbs ${fmt(carbs.value)}`,
                      fat && `Fat ${fmt(fat.value)}`,
                    ].filter(Boolean).join(', ')}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      
    </section>
  );
}
