import { formatDate } from '../format.js';

export default function CreditsBadge({ credits, error, onRefresh }) {
  let text = 'Checking credits…';
  if (error) text = 'Credits unavailable';
  else if (credits) {
    const left = credits.remaining_credits;
    const total = credits.included_credits;
    text = left == null ? `${credits.used_credits ?? 0} credits used` : `${left} of ${total} credits left`;
  }
  const resets = credits?.resets_at ? `Resets ${formatDate(credits.resets_at)}` : error ? error.message : '';
  return (
    <button type="button" className="credits" onClick={onRefresh} title="Refresh credit balance (free)">
      <span className="credits-main">{text}</span>
      {resets && <span className="credits-sub">{resets}</span>}
    </button>
  );
}
