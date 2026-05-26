import axios from 'axios';
import { getAuthToken } from './ApiService';

const DEFAULT_URL = 'http://localhost:8001';

export const getAnalyticsUrl = () =>
  localStorage.getItem('atc_analytics_url') || DEFAULT_URL;

const analyticsApi = axios.create({ timeout: 60000 });

analyticsApi.interceptors.request.use(config => {
  config.baseURL = getAnalyticsUrl();
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default analyticsApi;
