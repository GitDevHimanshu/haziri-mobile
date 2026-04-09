import AsyncStorage from '@react-native-async-storage/async-storage';

const HARDCODED_URL = 'https://chalkpad-attendance.onrender.com';

// ── Storage helpers ───────────────────────────────────────────────
export const getTeacherId = async () => {
  try { return (await AsyncStorage.getItem('teacherId')) || 'default'; }
  catch { return 'default'; }
};
export const saveTeacherId = async (id) => {
  await AsyncStorage.setItem('teacherId', id.trim().toLowerCase());
};

export const getTrainerName = async () => {
  try { return (await AsyncStorage.getItem('trainerName')) || ''; }
  catch { return ''; }
};
export const saveTrainerName = async (name) => {
  await AsyncStorage.setItem('trainerName', name.trim());
};

export const getTimetable = async () => {
  try { 
    const str = await AsyncStorage.getItem('timetableData');
    return str ? JSON.parse(str) : [];
  } catch { return []; }
};
export const saveTimetable = async (data) => {
  await AsyncStorage.setItem('timetableData', JSON.stringify(data));
};

export const getServerUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem('serverUrl');
    return (saved && saved.startsWith('http')) ? saved.replace(/\/$/, '') : HARDCODED_URL;
  } catch { return HARDCODED_URL; }
};
export const saveServerUrl = async (url) => {
  await AsyncStorage.setItem('serverUrl', url.trim().replace(/\/$/, ''));
};

// ── Fetch with automatic retry and long timeout ────────────────────
const fetchWithRetry = async (url, options = {}, retries = 2, delay = 2000) => {
  const timeoutMs = 45000; // Increased to 45s for Render.com cold starts
  
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      
      // Cloudflare 521 or standard error
      if (res.status === 521 || res.status >= 500) {
        if (i < retries) {
          console.log(`[API] Server waking up (${res.status}). Retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (i < retries) {
        console.log(`[API] Connection failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
};

const handle = async (res) => {
  if (!res.ok) {
    if (res.status === 521) throw new Error('Server is waking up. Please wait a few seconds.');
    throw new Error(`Server error: HTTP ${res.status}`);
  }
  return res.json();
};

// ── API calls ─────────────────────────────────────────────────────
export const fetchSessions = async ({ limit = 1000, search = '' } = {}) => {
  const [base, teacherId] = await Promise.all([getServerUrl(), getTeacherId()]);
  return fetchWithRetry(
    `${base}/api/sessions?limit=${limit}&search=${encodeURIComponent(search)}&teacherId=${encodeURIComponent(teacherId)}`
  ).then(handle);
};

export const fetchSessionById = async (id) => {
  const base = await getServerUrl();
  return fetchWithRetry(`${base}/api/sessions/${id}`).then(handle);
};

export const fetchStats = async () => {
  const [base, teacherId] = await Promise.all([getServerUrl(), getTeacherId()]);
  return fetchWithRetry(`${base}/api/stats?teacherId=${encodeURIComponent(teacherId)}`).then(handle);
};

export const deleteSession = async (id) => {
  const base = await getServerUrl();
  return fetchWithRetry(`${base}/api/sessions/${id}`, { method: 'DELETE' }).then(handle);
};
