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

// ── Fetch with timeout ────────────────────────────────────────────
const fetchWithTimeout = (url, options = {}, ms = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};
const handle = async (res) => {
  if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
  return res.json();
};

// ── API calls ─────────────────────────────────────────────────────
export const fetchSessions = async ({ limit = 1000, search = '' } = {}) => {
  const [base, teacherId] = await Promise.all([getServerUrl(), getTeacherId()]);
  return fetchWithTimeout(
    `${base}/api/sessions?limit=${limit}&search=${encodeURIComponent(search)}&teacherId=${encodeURIComponent(teacherId)}`
  ).then(handle);
};

export const fetchSessionById = async (id) => {
  const base = await getServerUrl();
  return fetchWithTimeout(`${base}/api/sessions/${id}`).then(handle);
};

export const fetchStats = async () => {
  const [base, teacherId] = await Promise.all([getServerUrl(), getTeacherId()]);
  return fetchWithTimeout(`${base}/api/stats?teacherId=${encodeURIComponent(teacherId)}`).then(handle);
};

export const deleteSession = async (id) => {
  const base = await getServerUrl();
  return fetchWithTimeout(`${base}/api/sessions/${id}`, { method: 'DELETE' }).then(handle);
};

export const uploadTimetablePdf = async (fileUri, trainerName) => {
  const base = await getServerUrl();
  
  const formData = new FormData();
  formData.append('trainerName', trainerName);
  formData.append('file', {
    uri: fileUri,
    type: 'application/pdf',
    name: 'timetable.pdf'
  });

  const response = await fetch(`${base}/api/parse-timetable`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      // DO NOT set Content-Type header manually for FormData in React Native
    }
  });

  return handle(response);
};
