import api from './client'

export const getAdminStats   = ()           => api.get('/admin/stats')
export const getAdminReports = (params = {}) => api.get('/admin/reports', { params })
export const exportCsv       = ()           => api.get('/admin/export', { responseType: 'blob' })
export const getHeatmapData  = ()           => api.get('/reports/heatmap')

// status + optional after-photo file
export const updateStatus = (id, status, afterPhoto = null) => {
  const fd = new FormData()
  fd.append('status', status)
  if (afterPhoto) fd.append('after_photo', afterPhoto)
  return api.patch(`/admin/reports/${id}/status`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
