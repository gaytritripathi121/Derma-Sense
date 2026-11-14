import { apiRequest } from './api.js';

export const reportService = {
  downloadScreeningPdf: async ({ record, reportId }) => {
    const res = await apiRequest('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ record, reportId }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeId = (record?.reportId || reportId || 'screening').replace(/[^a-zA-Z0-9_-]/g, '');
    a.href = url;
    a.download = `DermaSense-Report-${safeId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
