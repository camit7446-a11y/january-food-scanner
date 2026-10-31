// The nutrient objects from January look like { calories: { value: 682, unit: "kcal" }, ... }.
// These helpers read them defensively so a missing nutrient never breaks the screen.

export function toMap(nutrients) {
  if (!nutrients) return {};
  if (Array.isArray(nutrients)) {
    return Object.fromEntries(nutrients.map((n, i) => [n.id || n.key || n.name || String(i), n]));
  }
  return nutrients;
}

export function read(n) {
  if (n == null) return null;
  if (typeof n === 'number') return { value: n, unit: '' };
  if (typeof n === 'object' && 'value' in n) return { value: n.value, unit: n.unit || '' };
  return null;
}

export function fmt(r) {
  if (!r || r.value == null) return '–';
  const v = typeof r.value === 'number' ? String(Math.round(r.value * 10) / 10) : String(r.value);
  return r.unit ? `${v} ${r.unit}` : v;
}

export function pick(map, names) {
  for (const name of names) {
    if (map[name] != null) return { key: name, value: read(map[name]) };
  }
  return null;
}

export function humanize(key) {
  const s = String(key).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function confidenceText(c) {
  if (c == null) return '';
  if (typeof c === 'number') return `${Math.round((c <= 1 ? c * 100 : c))}% confident`;
  return `${c} confidence`;
}

export function servingText(food) {
  const s = food?.servings?.[0] || food?.serving;
  if (!s) return '';
  const label = s.name || s.description || s.unit || '';
  return [s.quantity, label].filter((x) => x !== undefined && x !== '').join(' ');
}

export function detectionsOf(result) {
  return Array.isArray(result?.detections) ? result.detections : [];
}

export function listFromSearch(data) {
  if (Array.isArray(data)) return data;
  return data?.foods || data?.items || data?.results || data?.data || [];
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
