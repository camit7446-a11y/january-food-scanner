// The browser only ever talks to our own server (/api/...). The January key stays on the server.

export class ApiError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function userId() {
  // A stable anonymous id so January can tell your end users apart. Swap in your real user id.
  try {
    let id = localStorage.getItem('jfs-user');
    if (!id) {
      id = `u_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem('jfs-user', id);
    }
    return id;
  } catch {
    return 'demo-user';
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-app-user': userId(), ...(options.headers || {}) },
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the app server. Is it running?');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.code || 'error', data?.message || `Request failed (${res.status})`, data?.retry_after);
  }
  return data;
}

export const api = {
  credits: () => request('/api/credits'),
  analyze: ({ image, context, fast, signal }) =>
    request('/api/analyze', { method: 'POST', body: JSON.stringify({ image, context, fast }), signal }),
  searchFoods: (query, type) =>
    request(`/api/foods?${new URLSearchParams({ query, limit: '10', ...(type ? { type } : {}) })}`),
};

// Turns an API error into a message that says what to do next.
export function explainError(err) {
  const wait = err.retryAfter ? ` Try again in about ${err.retryAfter} seconds.` : '';
  switch (err.code) {
    case 'missing_api_key':
      return 'The server has no January API key. Add JANUARY_API_KEY to the .env file and restart.';
    case 'unauthorized':
    case 'forbidden':
      return 'January rejected the API key. Check that JANUARY_API_KEY in .env is a current sk- key.';
    case 'credit_limit_exceeded':
      return 'You have used all your January credits for this billing period. They reset on the date shown in the credits badge.';
    case 'rate_limited':
    case 'app_scan_limit':
      return `${err.message}${wait}`;
    case 'image_unreachable':
    case 'image_corrupt':
    case 'image_format_unsupported':
    case 'image_invalid_base64':
      return `January could not use that photo (${err.message}). Try a different JPG or PNG.`;
    case 'image_too_large':
      return err.message;
    case 'network':
      return err.message;
    default:
      return err.message || 'Something went wrong. Try again.';
  }
}
