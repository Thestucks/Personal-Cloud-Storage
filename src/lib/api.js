const API_URL = import.meta.env.VITE_API_URL || (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8787'
  }
  return 'https://cloudstorage-api.YOUR-WORKER-SUBDOMAIN.workers.dev'
})()

function getToken() {
  return localStorage.getItem('auth_token')
}

function setToken(token) {
  if (token) localStorage.setItem('auth_token', token)
  else localStorage.removeItem('auth_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    setToken(null)
    window.location.hash = '#/login'
    throw new Error('Sesi berakhir, silakan login ulang')
  }

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request gagal')
  return data
}

export const api = {
  // Auth
  async login(password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    setToken(data.token)
    return data
  },

  async verify() {
    try {
      const data = await request('/api/auth/me')
      return data
    } catch {
      setToken(null)
      return { valid: false }
    }
  },

  logout() {
    setToken(null)
  },

  // Accounts
  async getAccounts() {
    return request('/api/accounts')
  },

  async getAccount(id) {
    return request(`/api/accounts/${id}`)
  },

  async createAccount(data) {
    return request('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateAccount(id, data) {
    return request(`/api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteAccount(id) {
    return request(`/api/accounts/${id}`, { method: 'DELETE' })
  },

  async testConnection(data) {
    if (data.id) {
      return request(`/api/accounts/${data.id}/test`, { method: 'POST' })
    }
    return request('/api/accounts/test-external', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getAccountUsage(id) {
    return request(`/api/accounts/${id}/usage`)
  },

  // Folders
  async getFolders(accountId) {
    return request(`/api/accounts/${accountId}/folders`)
  },

  async addFolder(accountId, name) {
    return request(`/api/accounts/${accountId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  async renameFolder(accountId, oldName, newName) {
    return request(`/api/accounts/${accountId}/folders/${encodeURIComponent(oldName)}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newName }),
    })
  },

  async deleteFolder(accountId, name) {
    return request(`/api/accounts/${accountId}/folders/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  },

  // Files
  async getFiles(accountId, folder) {
    const params = folder ? `?folder=${encodeURIComponent(folder)}` : ''
    return request(`/api/accounts/${accountId}/files${params}`)
  },

  async getAllFiles(accountId) {
    return request(`/api/accounts/${accountId}/files`)
  },

  async deleteFile(fileId, accountId, r2Key) {
    return request(`/api/files/${fileId}?account_id=${accountId}&key=${encodeURIComponent(r2Key)}`, {
      method: 'DELETE',
    })
  },

  async getPresignedUrl(accountId, folder, filename, contentType) {
    return request(`/api/accounts/${accountId}/presigned`, {
      method: 'POST',
      body: JSON.stringify({ folder, filename, contentType }),
    })
  },

  async getPreviewUrl(accountId, key) {
    return request(`/api/accounts/${accountId}/preview-url?key=${encodeURIComponent(key)}`)
  },

  async renameFile(accountId, fileId, newName, oldKey) {
    return request(`/api/files/${fileId}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newName, account_id: accountId, oldKey }),
    })
  },

  // Share
  async getShareLinks() {
    return request('/api/shares')
  },

  async createShareLink(accountId, r2Key, filename, expiresInDays = 7) {
    return request('/api/shares', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, r2_key: r2Key, filename, expiresInDays }),
    })
  },

  async deleteShareLink(id) {
    return request(`/api/shares/${id}`, { method: 'DELETE' })
  },

  async getSharedFile(token) {
    return request(`/api/share/${token}`)
  },
}
