import AsyncStorage from '@react-native-async-storage/async-storage';

// This URL points to your own secure proxy (Express/Vercel), not January directly.
// Keep JANUARY_API_KEY on that server; never put it in the Expo app.
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787').replace(/\/$/, '');
const USER_KEY = 'jfs-user';

async function getUserId() {
  let id = await AsyncStorage.getItem(USER_KEY);
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(USER_KEY, id);
  }
  return id;
}

async function apiRequest(path, options = {}) {
  const userId = await getUserId();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-app-user': userId,
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach the API server at ${API_URL}. Check the server URL and that your phone and computer are on the same Wi-Fi.`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export function analyzeFoodPhoto(image, context = '') {
  return apiRequest('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ image, context }),
  });
}

export async function searchFoods(query, limit = 15) {
  const data = await apiRequest(`/api/foods?query=${encodeURIComponent(query)}&limit=${limit}`);
  return data.foods || data.items || data.results || (Array.isArray(data) ? data : []);
}

export async function getCredits() {
  const data = await apiRequest('/api/credits');
  return data?.credits_remaining ?? data?.remaining_credits ?? data?.remaining ?? data?.credits?.remaining ?? null;
}
