import axios from 'axios';

const TOKEN_KEY = 'atc_auth_token';
const API_URL_KEY = 'atc_api_url';
const DEFAULT_URL  = 'http://localhost:3000';

export const getApiBaseUrl = () => {
  try {
    const raw = localStorage.getItem('@cloud_atc_system_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.config?.apiBaseUrl) return parsed.config.apiBaseUrl;
    }
  } catch {}
  return localStorage.getItem(API_URL_KEY) || DEFAULT_URL;
};

export const setApiBaseUrl  = (url)   => localStorage.setItem(API_URL_KEY, url);
export const getAuthToken   = ()      => localStorage.getItem(TOKEN_KEY);
export const setAuthToken   = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken = ()      => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({ timeout: 60000 });

// Attach dynamic base URL + Bearer token on every request
api.interceptors.request.use(config => {
  config.baseURL = getApiBaseUrl();
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('atc:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;

export const precheckShiftExchange = async (payload) => {
  const res = await api.post('/api/shift-exchanges/precheck', payload);
  return res.data;
};

// ── Analytics helpers ──────────────────────────────────────────────────────

export const reviewRosterDraft = async (payload) => {
  const res = await api.post('/api/schedules/review-roster-draft', payload);
  return res.data;
};

export const reviewMacroRoster = async (payload) => {
  const res = await api.post('/api/schedules/review-macro-roster', payload);
  return res.data;
};

export const getRosterChecklist = async (payload) => {
  const res = await api.post('/api/schedules/roster-checklist', payload);
  return res.data;
};

export const getMacroChecklist = async (payload) => {
  const res = await api.post('/api/schedules/macro-checklist', payload);
  return res.data;
};
