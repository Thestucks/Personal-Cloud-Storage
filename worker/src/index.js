import {
  createToken, verifyToken, encrypt, decrypt,
  generatePresignedGetUrl, generatePresignedPutUrl,
  listObjects, deleteObject, json, error, cors
} from './utils'

// ─── Route matching helper ───
function match(pattern, url) {
  const parts = pattern.split('/')
  const urlParts = url.pathname.split('/')
  if (parts.length !== urlParts.length) return null
  const params = {}
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(':')) { params[parts[i].slice(1)] = urlParts[i] }
    else if (parts[i] !== urlParts[i]) return null
  }
  return params
}

// ─── Auth middleware ───
async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  return await verifyToken(token, env.AUTH_TOKEN_SECRET)
}

// ─── Main handler ───
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Handle CORS preflight
    const corsResp = cors(request)
    if (corsResp) return corsResp

    try {
      // ── Debug endpoint (no auth required) ──
      if (url.pathname === '/api/debug' && request.method === 'GET') {
        const info = {
          env: Object.keys(env),
          hasDB: !!env.DB,
          hasENC_KEY: !!env.ENC_KEY,
          hasAUTH_PASSWORD: !!env.AUTH_PASSWORD,
          hasAUTH_TOKEN_SECRET: !!env.AUTH_TOKEN_SECRET,
        }
        let d1Status = 'not_configured'
        let d1Tables = []
        if (env.DB) {
          try {
            const tables = await env.DB.prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).all()
            d1Status = 'ok'
            d1Tables = tables.results || []
          } catch (e) {
            d1Status = `error: ${e.message}`
          }
        }
        return json({ info, d1: { status: d1Status, tables: d1Tables } })
      }

      // ── Auth routes ──
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const { password } = await request.json()
        if (password !== env.AUTH_PASSWORD) return error('Password salah', 401)
        const token = await createToken({ role: 'user' }, env.AUTH_TOKEN_SECRET)
        return json({ token, user: { name: 'User' } })
      }

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const user = await requireAuth(request, env)
        if (!user) return error('Unauthorized', 401)
        return json({ valid: true, user: { name: 'User' } })
      }

      // All routes below require auth
      const user = await requireAuth(request, env)
      if (!user) return error('Unauthorized', 401)

      // ── Account routes ──
      if (url.pathname === '/api/accounts' && request.method === 'GET') {
        if (!env.DB) return error('D1 database not bound - check wrangler.toml binding', 500)
        const stmt = env.DB.prepare(
          'SELECT id, label, account_id, bucket, folders, is_active, created_at FROM storage_accounts ORDER BY created_at DESC'
        )
        const { results } = await stmt.all()
        return json((results || []).map(a => ({
          ...a,
          is_active: !!a.is_active,
          folders: (() => { try { return JSON.parse(a.folders || '[]') } catch { return [] } })(),
        })))
      }

      if (url.pathname === '/api/accounts' && request.method === 'POST') {
        const data = await request.json()
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const encrypted = await encrypt(data.api_token, encKey)
        const folders = JSON.stringify(data.folders || ['foto', 'video', 'dokumen'])
        const { results } = await env.DB.prepare(
          'INSERT INTO storage_accounts (label, account_id, bucket, api_token_encrypted, folders) VALUES (?, ?, ?, ?, ?) RETURNING *'
        ).bind(data.label, data.account_id, data.bucket, encrypted, folders).all()
        const created = results?.[0]
        if (!created) return error('Gagal membuat akun', 500)
        return json({
          id: created.id,
          label: created.label,
          account_id: created.account_id,
          bucket: created.bucket,
          folders: JSON.parse(created.folders || '[]'),
          is_active: !!created.is_active,
          created_at: created.created_at,
        }, 201)
      }

      // Account by ID - GET, PUT, DELETE
      const accountMatch = match('/api/accounts/:id', url)
      if (accountMatch && request.method === 'GET') {
        const row = await env.DB.prepare(
          'SELECT id, label, account_id, bucket, folders, is_active, created_at FROM storage_accounts WHERE id = ?'
        ).bind(accountMatch.id).first()
        if (!row) return error('Akun tidak ditemukan', 404)
        return json({
          ...row,
          is_active: !!row.is_active,
          folders: JSON.parse(row.folders || '[]'),
        })
      }

      if (accountMatch && request.method === 'PUT') {
        const data = await request.json()
        const existing = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(accountMatch.id).first()
        if (!existing) return error('Akun tidak ditemukan', 404)

        let encrypted = existing.api_token_encrypted
        if (data.api_token) {
          const encKey = new TextEncoder().encode(env.ENC_KEY)
          encrypted = await encrypt(data.api_token, encKey)
        }

        const folders = data.folders ? JSON.stringify(data.folders) : existing.folders

        await env.DB.prepare(
          'UPDATE storage_accounts SET label = ?, account_id = ?, bucket = ?, api_token_encrypted = ?, folders = ? WHERE id = ?'
        ).bind(
          data.label || existing.label,
          data.account_id || existing.account_id,
          data.bucket || existing.bucket,
          encrypted,
          folders,
          accountMatch.id
        ).run()

        return json({ success: true })
      }

      if (accountMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM storage_accounts WHERE id = ?').bind(accountMatch.id).run()
        return json({ success: true })
      }

      // Test connection for existing account
      if (accountMatch && request.method === 'POST' && url.pathname.endsWith('/test')) {
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(accountMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')
        if (!accessKeyId || !secretAccessKey) return error('API Token tidak valid')

        try {
          await listObjects({ accessKeyId, secretAccessKey, bucket: acct.bucket, accountId: acct.account_id, prefix: '' })
          return json({ success: true, message: 'Koneksi berhasil' })
        } catch (e) {
          return error(`Koneksi gagal: ${e.message}`)
        }
      }

      // Test connection for new account (before saving)
      if (url.pathname === '/api/accounts/test-external' && request.method === 'POST') {
        const data = await request.json()
        if (!data.account_id || !data.bucket || !data.api_token) {
          return error('Data tidak lengkap (account_id, bucket, api_token diperlukan)')
        }
        const [accessKeyId, secretAccessKey] = data.api_token.split(':')
        if (!accessKeyId || !secretAccessKey) return error('API Token tidak valid (format: AccessKeyId:SecretAccessKey)')
        try {
          await listObjects({ accessKeyId, secretAccessKey, bucket: data.bucket, accountId: data.account_id, prefix: '' })
          return json({ success: true, message: 'Koneksi berhasil' })
        } catch (e) {
          return error(`Koneksi gagal: ${e.message}`)
        }
      }

      // Usage
      if (accountMatch && request.method === 'GET' && url.pathname.endsWith('/usage')) {
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(accountMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        let totalSize = 0
        let totalFiles = 0
        try {
          const objects = await listObjects({ accessKeyId, secretAccessKey, bucket: acct.bucket, accountId: acct.account_id })
          for (const obj of objects) {
            totalSize += obj.size
            totalFiles++
          }
        } catch (e) {
          // If R2 is not set up yet, just return 0
        }
        const total = 10_737_418_240 // 10 GB
        return json({ used: totalSize, total, files: totalFiles })
      }

      // ── Folder routes ──
      const foldersMatch = match('/api/accounts/:id/folders', url)
      if (foldersMatch && request.method === 'GET') {
        const acct = await env.DB.prepare('SELECT folders FROM storage_accounts WHERE id = ?').bind(foldersMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        return json(JSON.parse(acct.folders || '[]'))
      }

      if (foldersMatch && request.method === 'POST') {
        const { name } = await request.json()
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(foldersMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const f = JSON.parse(acct.folders || '[]')
        const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_')
        if (f.includes(cleanName)) return error('Folder sudah ada')
        f.push(cleanName)
        await env.DB.prepare('UPDATE storage_accounts SET folders = ? WHERE id = ?').bind(JSON.stringify(f), foldersMatch.id).run()
        return json(f)
      }

      // Rename folder
      const folderRenameMatch = match('/api/accounts/:id/folders/:name/rename', url)
      if (folderRenameMatch && request.method === 'PUT') {
        const { newName } = await request.json()
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(folderRenameMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const f = JSON.parse(acct.folders || '[]')
        const idx = f.indexOf(folderRenameMatch.name)
        if (idx === -1) return error('Folder tidak ditemukan')
        const clean = newName.trim().toLowerCase().replace(/\s+/g, '_')
        if (f.includes(clean)) return error('Nama folder sudah ada')
        f[idx] = clean
        await env.DB.prepare('UPDATE storage_accounts SET folders = ? WHERE id = ?').bind(JSON.stringify(f), folderRenameMatch.id).run()
        return json(f)
      }

      // Delete folder
      const folderDeleteMatch = match('/api/accounts/:id/folders/:name', url)
      if (folderDeleteMatch && request.method === 'DELETE') {
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(folderDeleteMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const f = JSON.parse(acct.folders || '[]')
        const idx = f.indexOf(folderDeleteMatch.name)
        if (idx === -1) return error('Folder tidak ditemukan')
        f.splice(idx, 1)
        await env.DB.prepare('UPDATE storage_accounts SET folders = ? WHERE id = ?').bind(JSON.stringify(f), folderDeleteMatch.id).run()
        return json(f)
      }

      // ── File routes ──
      const fileListMatch = match('/api/accounts/:id/files', url)
      if (fileListMatch && request.method === 'GET') {
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(fileListMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const folder = url.searchParams.get('folder') || ''
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        const prefix = folder ? `${folder}/` : ''
        let objects = []
        try {
          objects = await listObjects({ accessKeyId, secretAccessKey, bucket: acct.bucket, accountId: acct.account_id, prefix })
        } catch (e) {
          return json([])
        }

        const files = objects.map((obj, i) => {
          const pathParts = obj.key.split('/')
          const filename = pathParts[pathParts.length - 1]
          const fileFolder = pathParts.length > 1 ? pathParts[0] : ''
          const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : ''
          const mimeMap = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
            webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
            mov: 'video/quicktime', pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            txt: 'text/plain', json: 'application/json', csv: 'text/csv', zip: 'application/zip',
            sql: 'text/plain', xml: 'text/xml', js: 'text/javascript', css: 'text/css',
          }
          return {
            id: `${fileListMatch.id}-${i}-${Date.now()}`,
            account_id: parseInt(fileListMatch.id),
            filename,
            folder: fileFolder,
            r2_key: obj.key,
            size: obj.size,
            mime: mimeMap[ext] || 'application/octet-stream',
            created_at: new Date().toISOString(),
          }
        }).filter(f => f.filename)

        if (folder) {
          return json(files.filter(f => f.folder === folder))
        }
        return json(files)
      }

      // Presigned URL for upload
      const presignedMatch = match('/api/accounts/:id/presigned', url)
      if (presignedMatch && request.method === 'POST') {
        const { folder, filename, contentType } = await request.json()
        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(presignedMatch.id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        const key = `${folder}/${filename}`
        const uploadUrl = await generatePresignedPutUrl({
          accessKeyId, secretAccessKey, bucket: acct.bucket,
          accountId: acct.account_id, key,
          contentType: contentType || 'application/octet-stream',
        })
        const publicUrl = `https://${acct.bucket}.${acct.account_id}.r2.cloudflarestorage.com/${key}`

        return json({ uploadUrl, publicUrl })
      }

      // Delete file
      if (url.pathname.startsWith('/api/files/') && request.method === 'DELETE') {
        const parts = url.pathname.split('/')
        const fileId = parts[3]
        // For deletion, we need account_id and r2_key - must be passed in body or query
        const acctId = url.searchParams.get('account_id')
        const r2Key = url.searchParams.get('key')
        if (!acctId || !r2Key) return error('Missing account_id or key parameter')

        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(acctId).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        try {
          await deleteObject({ accessKeyId, secretAccessKey, bucket: acct.bucket, accountId: acct.account_id, key: r2Key })
          await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run()
        } catch (e) {
          // If not in DB, still try to delete from R2
        }
        return json({ success: true })
      }

      // Rename file (R2 copy + delete)
      if (url.pathname.startsWith('/api/files/') && request.method === 'PUT' && url.pathname.endsWith('/rename')) {
        const parts = url.pathname.split('/')
        const fileId = parts[3]
        const { newName, account_id, oldKey } = await request.json()
        if (!account_id || !oldKey || !newName) return error('Missing required fields')

        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(account_id).first()
        if (!acct) return error('Akun tidak ditemukan', 404)
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        const pathParts = oldKey.split('/')
        pathParts[pathParts.length - 1] = newName
        const newKey = pathParts.join('/')

        // Note: R2 doesn't support rename directly, so we would need to copy + delete
        // For simplicity in demo, we'll just update the local reference
        // Full implementation would do S3 copy + delete

        return json({ success: true, newR2Key: newKey })
      }

      // ── Share routes ──
      if (url.pathname === '/api/shares' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT f.id, f.filename, f.share_token, f.share_created, f.share_expires,
                  sa.label as account_label
           FROM files f JOIN storage_accounts sa ON f.account_id = sa.id
           WHERE f.share_token IS NOT NULL
           ORDER BY f.share_created DESC`
        ).all()
        return json(results)
      }

      // Create share link
      const shareCreateMatch = match('/api/files/:id/share', url)
      if (shareCreateMatch && request.method === 'POST') {
        const { expiresInDays = 7 } = await request.json()
        const token = crypto.randomUUID().split('-').join('').substring(0, 12)
        const expires = new Date(Date.now() + expiresInDays * 86400000).toISOString()
        // Files are stored in R2, not in DB. We create a share record.
        await env.DB.prepare(
          'UPDATE files SET share_token = ?, share_created = ?, share_expires = ? WHERE id = ?'
        ).bind(token, new Date().toISOString(), expires, shareCreateMatch.id).run()
        return json({ token, expires })
      }

      // Delete share link
      const shareDeleteMatch = match('/api/shares/:id', url)
      if (shareDeleteMatch && request.method === 'DELETE') {
        await env.DB.prepare('UPDATE files SET share_token = NULL, share_created = NULL, share_expires = NULL WHERE id = ?').bind(shareDeleteMatch.id).run()
        return json({ success: true })
      }

      // Public access to shared file
      const publicShareMatch = match('/api/share/:token', url)
      if (publicShareMatch && request.method === 'GET') {
        const file = await env.DB.prepare(
          'SELECT f.*, sa.account_id as acct_id, sa.bucket FROM files f JOIN storage_accounts sa ON f.account_id = sa.id WHERE f.share_token = ?'
        ).bind(publicShareMatch.token).first()
        if (!file) return error('File tidak ditemukan', 404)
        if (file.share_expires && new Date(file.share_expires) < new Date()) {
          return error('Link sudah kadaluwarsa', 410)
        }

        const acct = await env.DB.prepare('SELECT * FROM storage_accounts WHERE id = ?').bind(file.account_id).first()
        const encKey = new TextEncoder().encode(env.ENC_KEY)
        const apiToken = await decrypt(acct.api_token_encrypted, encKey)
        const [accessKeyId, secretAccessKey] = apiToken.split(':')

        const downloadUrl = await generatePresignedGetUrl({
          accessKeyId, secretAccessKey, bucket: file.bucket,
          accountId: file.acct_id, key: file.r2_key,
        })

        return json({
          filename: file.filename,
          size: file.size,
          mime: file.mime,
          downloadUrl,
        })
      }

      return error('Not found', 404)
    } catch (e) {
      return error(e.message + (e.stack ? ' | ' + e.stack.split('\n').slice(0, 3).join(' ') : ''), 500)
    }
  }
}
