// ─── Auth Token (HMAC-based, like JWT) ───
export async function createToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 * 7 }))
  const signature = await hmac(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

export async function verifyToken(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = await hmac(`${header}.${body}`, secret)
  if (signature !== expected) return null
  try {
    const payload = JSON.parse(atob(body))
    if (payload.exp && payload.exp < Date.now()) return null
    return payload
  } catch { return null }
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

// ─── Encryption (AES-GCM) for R2 API Tokens ───
async function normalizeKey(raw) {
  const hash = await crypto.subtle.digest('SHA-256', raw)
  return hash
}

export async function encrypt(text, encKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const normalized = await normalizeKey(encKey)
  const key = await crypto.subtle.importKey(
    'raw', normalized, { name: 'AES-GCM' }, false, ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  )
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(cipherB64, encKey) {
  const combined = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const normalized = await normalizeKey(encKey)
  const key = await crypto.subtle.importKey(
    'raw', normalized, { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

// ─── AWS Signature V4 helpers ───
function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(data) {
  const hash = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data)
  return toHex(hash)
}

async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? new TextEncoder().encode(data) : data)
  return new Uint8Array(sig)
}

async function getSignatureKey(key, date, region, service) {
  const kDate = await hmacSha256(`AWS4${key}`, date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return await hmacSha256(kService, 'aws4_request')
}

/**
 * Generate a presigned GET URL for downloading from R2
 */
export async function generatePresignedGetUrl({ accessKeyId, secretAccessKey, bucket, accountId, key, expiresIn = 3600 }) {
  const region = 'auto'
  const service = 's3'
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const endpoint = `https://${host}/${key}`
  const date = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
  const dateStamp = date.substring(0, 8)

  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalUri = '/' + key
  const canonicalQuery = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`)}`,
    `X-Amz-Date=${date}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
  ].join('&')

  const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\n${signedHeaders}\n${payloadHash}`
  const canonicalRequestHash = await sha256(canonicalRequest)

  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = toHex(signatureBytes)

  return `${endpoint}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/**
 * Generate a presigned PUT URL for uploading to R2
 */
export async function generatePresignedPutUrl({ accessKeyId, secretAccessKey, bucket, accountId, key, expiresIn = 3600, contentType }) {
  const region = 'auto'
  const service = 's3'
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const endpoint = `https://${host}/${key}`
  const date = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
  const dateStamp = date.substring(0, 8)

  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalUri = '/' + key
  let canonicalQuery = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`)}`,
    `X-Amz-Date=${date}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${signedHeaders}`,
  ].join('&')

  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\n${signedHeaders}\n${payloadHash}`
  const canonicalRequestHash = await sha256(canonicalRequest)

  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = toHex(signatureBytes)

  return `${endpoint}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/**
 * List objects in R2 bucket with a prefix
 */
export async function listObjects({ accessKeyId, secretAccessKey, bucket, accountId, prefix = '' }) {
  const region = 'auto'
  const service = 's3'
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const listEndpoint = `https://${host}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
  const date = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
  const dateStamp = date.substring(0, 8)

  const canonicalUri = '/'
  const canonicalQuery = `list-type=2&prefix=${encodeURIComponent(prefix)}`
  const signedHeaders = 'host'
  const payloadHash = await sha256('')

  const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\n${signedHeaders}\n${payloadHash}`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = toHex(signatureBytes)

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${listEndpoint}`, {
    headers: {
      'Authorization': authHeader,
      'x-amz-date': date,
      'x-amz-content-sha256': payloadHash,
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`R2 list failed: ${response.status} ${text}`)
  }

  const xml = await response.text()
  // Simple XML parser - extract sizes and keys
  const items = []
  const keyRegex = /<Key>([^<]+)<\/Key>/g
  const sizeRegex = /<Size>(\d+)<\/Size>/g
  const keys = [...xml.matchAll(keyRegex)].map(m => m[1])
  const sizes = [...xml.matchAll(sizeRegex)].map(m => parseInt(m[1]))
  for (let i = 0; i < keys.length; i++) {
    items.push({ key: keys[i], size: sizes[i] || 0 })
  }
  return items
}

/**
 * Delete an object from R2
 */
export async function deleteObject({ accessKeyId, secretAccessKey, bucket, accountId, key }) {
  const region = 'auto'
  const service = 's3'
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`
  const endpoint = `https://${host}/${key}`
  const date = new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'
  const dateStamp = date.substring(0, 8)

  const canonicalUri = '/' + key
  const signedHeaders = 'host'
  const payloadHash = await sha256('')

  const canonicalRequest = `DELETE\n${canonicalUri}\n\nhost:${host}\n\n${signedHeaders}\n${payloadHash}`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = toHex(signatureBytes)

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader,
      'x-amz-date': date,
      'x-amz-content-sha256': payloadHash,
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`R2 delete failed: ${response.status} ${text}`)
  }

  return { success: true }
}

// ─── Response helpers ───
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }
  })
}

export function error(message, status = 400) {
  return json({ error: message }, status)
}

export function cors(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' }
    })
  }
}
