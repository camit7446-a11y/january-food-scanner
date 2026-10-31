import { useEffect, useRef, useState } from 'react';
import { api, explainError } from '../api.js';
import { prepareImage } from '../image.js';
import { toMap, pick, fmt } from '../format.js';
import NutritionPanel from './NutritionPanel.jsx';

const HISTORY_KEY = 'jfs-history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* storage full or blocked */ }
}

export default function ScanTab({ onUsedCredits }) {
  const [preview, setPreview] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const [context, setContext] = useState('');
  const [fast, setFast] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  useEffect(() => {
    if (status !== 'loading') return undefined;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function takeFile(file) {
    if (!file) return;
    setError('');
    setResult(null);
    setStatus('idle');
    try {
      const ready = await prepareImage(file);
      setPrepared(ready);
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setPrepared(null);
      setPreview(null);
      setStatus('error');
      setError(e.message);
    }
  }

  async function scan() {
    if (!prepared) return;
    setStatus('loading');
    setError('');
    setResult(null);
    try {
      const data = await api.analyze({ image: prepared.dataUri, context, fast });
      setResult(data);
      setStatus('done');
      const next = [{ id: Date.now(), at: new Date().toISOString(), thumb: prepared.thumb, result: data }, ...history].slice(0, 8);
      setHistory(next);
      saveHistory(next);
    } catch (e) {
      setStatus('error');
      setError(explainError(e));
    } finally {
      onUsedCredits();
    }
  }

  function openFromHistory(item) {
    setResult(item.result);
    setStatus('done');
    setError('');
    setPreview(item.thumb);
    setPrepared(null);
  }

  const busy = status === 'loading';

  return (
    <div className="grid">
      <div className="col">
        <div
          className={`drop ${dragging ? 'drop-on' : ''} ${preview ? 'drop-has' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}
        >
          {preview ? (
            <img src={preview} alt="Your meal photo" />
          ) : (
            <p>Drop a photo of your meal here, or use the buttons below.</p>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>Take photo</button>
          <button type="button" className="btn" onClick={() => libraryRef.current?.click()}>Choose photo</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={libraryRef} type="file" accept="image/*" hidden onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        <label className="field">
          <span>Details the photo can't show (optional)</span>
          <input
            type="text"
            value={context}
            maxLength={500}
            placeholder="For example: cooked in ghee, no sugar in the chai"
            onChange={(e) => setContext(e.target.value)}
          />
        </label>

        <label className="check">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
          <span>Use the faster standard analyzer. Same cost, usually quicker, may be less thorough on complex meals.</span>
        </label>

        <button type="button" className="btn btn-primary" disabled={!prepared || busy} onClick={scan}>
          {busy ? `Scanning… ${elapsed}s` : 'Scan meal'}
        </button>
        <p className="hint">Each scan uses 10 January credits.</p>

        {history.length > 0 && (
          <div className="history">
            <h3>Recent scans</h3>
            <ul>
              {history.map((h) => {
                const kcal = pick(toMap(h.result?.total_nutrients), ['calories', 'energy', 'kcal']);
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => openFromHistory(h)}>
                      <img src={h.thumb} alt="" />
                      <span className="h-name">{h.result?.meal_name || 'Scanned meal'}</span>
                      <span className="h-cal">{kcal ? fmt(kcal.value) : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="link" onClick={() => { setHistory([]); saveHistory([]); }}>Clear history</button>
          </div>
        )}
      </div>

      <div className="col">
        <NutritionPanel result={result} status={status} elapsed={elapsed} error={error} />
      </div>
    </div>
  );
}
