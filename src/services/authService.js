import { apiRequest } from './api.js';

export const authService = {
  getStatus: () => apiRequest('/auth/status'),

  register: (payload) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiRequest('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => apiRequest('/auth/me'),

  updateProfile: (payload) =>
    apiRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload) =>
    apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAccount: (payload) =>
    apiRequest('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),

  deleteHistoryRecord: (reportId) =>
    apiRequest(`/history/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
    }),
};
