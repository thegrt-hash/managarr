import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

export const getSettings = () => api.get('/settings').then(r => r.data)
export const saveSettings = (data: Record<string, string>) => api.post('/settings', data)

export const getDashboard = () => api.get('/dashboard').then(r => r.data)

export const getFolders = (params: Record<string, unknown>) =>
  api.get('/folders', { params }).then(r => r.data)

export const getFolder = (id: number) => api.get(`/folders/${id}`).then(r => r.data)

export const getDuplicates = (params?: Record<string, unknown>) =>
  api.get('/duplicates', { params }).then(r => r.data)

export const getIsoFiles = () => api.get('/iso-files').then(r => r.data)

export const startScan = () => api.post('/scan/start')
export const stopScan = () => api.post('/scan/stop')
export const getScanStatus = () => api.get('/scan/status').then(r => r.data)

export const bulkDelete = (file_ids: number[]) =>
  api.delete('/files/bulk', { data: { file_ids } }).then(r => r.data)

export const bulkMove = (file_ids: number[], destination: string) =>
  api.post('/files/move', { file_ids, destination }).then(r => r.data)

export const getBaselines = () => api.get('/baselines').then(r => r.data)
export const setBaseline = (id: number) => api.post(`/baselines/${id}`)
export const removeBaseline = (id: number) => api.delete(`/baselines/${id}`)

export const testSonarr = () => api.get('/sonarr/test').then(r => r.data)
export const syncSonarr = () => api.post('/sonarr/sync').then(r => r.data)
export const testRadarr = () => api.get('/radarr/test').then(r => r.data)
export const syncRadarr = () => api.post('/radarr/sync').then(r => r.data)
export const testBazarr = () => api.get('/bazarr/test').then(r => r.data)
export const searchSubtitles = (folder_ids: number[], languages?: string[]) =>
  api.post('/bazarr/search', { folder_ids, languages }).then(r => r.data)
export const searchWantedSubtitles = () => api.post('/bazarr/search-wanted').then(r => r.data)
