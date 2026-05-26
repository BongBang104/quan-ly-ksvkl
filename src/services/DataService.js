import api from './ApiService';

const ROUTE_MAP = {
  employees:  '/api/employees',
  settings:   '/api/settings',
  tasks:      '/api/tasks',
  activities: '/api/activities',
  requests:   '/api/requests',
  schedule:   '/api/schedules',
};

const route = (documentId) => ROUTE_MAP[documentId] ?? `/api/${documentId}`;

export const DataService = {
  // ── READ ──────────────────────────────────────────────────────────────
  fetchData: async (_settings, _collection, documentId) => {
    try {
      const { data } = await api.get(route(documentId));
      return data;
    } catch (err) {
      console.error(`[API] GET ${documentId}:`, err.response?.data?.message ?? err.message);
      return null;
    }
  },

  // ── BULK WRITE (replace all) ─────────────────────────────────────────
  saveData: async (_settings, _collection, documentId, payload) => {
    try {
      const { data } = await api.put(route(documentId), payload);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Không thể kết nối máy chủ API.';
      console.error(`[API] PUT ${documentId}:`, msg);
      throw new Error(msg);
    }
  },

  // ── CREATE (POST) ─────────────────────────────────────────────────────
  createItem: async (documentId, payload) => {
    try {
      const { data } = await api.post(route(documentId), payload);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Không thể kết nối máy chủ API.';
      console.error(`[API] POST ${documentId}:`, msg);
      throw new Error(msg);
    }
  },

  // ── UPDATE (PUT /:id) ─────────────────────────────────────────────────
  updateItem: async (documentId, id, payload) => {
    try {
      const { data } = await api.put(`${route(documentId)}/${id}`, payload);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Không thể kết nối máy chủ API.';
      console.error(`[API] PUT ${documentId}/${id}:`, msg);
      throw new Error(msg);
    }
  },

  // ── DELETE ────────────────────────────────────────────────────────────
  deleteItem: async (documentId, id) => {
    try {
      const { data } = await api.delete(`${route(documentId)}/${id}`);
      return data;
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Không thể kết nối máy chủ API.';
      console.error(`[API] DELETE ${documentId}/${id}:`, msg);
      throw new Error(msg);
    }
  },

  syncAllDataToNewServer: async () => true,
};
