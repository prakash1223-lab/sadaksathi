import api from './client'

export const getReports = (params = {}) => api.get('/reports', { params })

export const getHeatmap = () => api.get('/reports/heatmap')

export const getReport = (id) => api.get(`/reports/${id}`)

export const createReport = (formData) =>
  api.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const upvoteReport = (id) => api.post(`/reports/${id}/upvote`)

export const updateReport = (id, data) => api.patch(`/reports/${id}`, data)

export const deleteReport = (id) => api.delete(`/reports/${id}`)

export const analyzePhoto = (file) => {
  const fd = new FormData()
  fd.append('photo', file)
  return api.post('/ai/analyze', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
