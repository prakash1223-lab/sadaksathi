import api from './client'

export const login = (phone, password) => api.post('/auth/login', { phone, password })

export const register = (data) => api.post('/auth/register', data)

export const getMe = () => api.get('/auth/me')

export const getProfile = () => api.get('/users/profile')

export const updateProfile = (data) => api.patch('/users/profile', data)

export const changePassword = (data) => api.patch('/users/change-password', data)

export const getLeaderboard = () => api.get('/users/leaderboard')
