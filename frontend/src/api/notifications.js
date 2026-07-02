import api from './client'

export const getNotifications  = ()    => api.get('/notifications')
export const getUnreadCount    = ()    => api.get('/notifications/unread-count')
export const markRead          = (id)  => api.patch(`/notifications/${id}/read`)
export const markAllRead       = ()    => api.patch('/notifications/read-all')
