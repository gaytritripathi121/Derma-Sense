import { apiRequest } from './api.js';

export const predictionService = {
  analyzeLesion: async ({ imageFile, patientHistory }) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('patientHistory', JSON.stringify(patientHistory || {}));
    return apiRequest('/predict', {
      method: 'POST',
      body: formData,
    });
  },

  getHistory: () => apiRequest('/history'),

  getHistoryRecord: (reportId) => apiRequest(`/history/${encodeURIComponent(reportId)}`),

  clearHistory: () =>
    apiRequest('/history', {
      method: 'DELETE',
    }),

  generateSafeCornerPlan: (payload) =>
    apiRequest('/safe-corner/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportCalendarIcs: async (payload) => {
    const res = await apiRequest('/safe-corner/calendar', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dermasense-followup.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
