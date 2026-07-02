import api from './client'

export const getAdminStats   = ()           => api.get('/admin/stats')
export const getAdminReports = (params = {}) => api.get('/admin/reports', { params })
export const updateStatus    = (id, status) => api.patch(`/admin/reports/${id}/status`, { status })
export const exportCsv       = ()           => api.get('/admin/export', { responseType: 'blob' })
export const getHeatmapData  = ()           => api.get('/reports/heatmap')
