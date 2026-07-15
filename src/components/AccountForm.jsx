import { useState } from 'react'
import { api } from '../lib/api'

export default function AccountForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    label: initial?.label || '',
    account_id: initial?.account_id || '',
    bucket: initial?.bucket || '',
    api_token: '',
    folders: initial?.folders?.join(', ') || 'foto, video, dokumen, backup',
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')

  const handleTest = async () => {
    if (!form.account_id || !form.bucket) {
      setError('Isi Account ID dan Bucket dulu')
      return
    }
    if (!form.api_token && !initial) {
      setError('Isi API Token dulu')
      return
    }
    setTesting(true)
    setError('')
    try {
      const data = {
        account_id: form.account_id,
        bucket: form.bucket,
      }
      if (initial) {
        data.id = initial.id
      } else {
        data.api_token = form.api_token
      }
      const res = await api.testConnection(data)
      alert(res.message)
    } catch (e) {
      setError(e.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const data = {
        ...form,
        folders: form.folders.split(',').map(f => f.trim()).filter(Boolean),
      }
      if (initial) {
        await api.updateAccount(initial.id, data)
      } else {
        await api.createAccount(data)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {initial ? 'Edit Akun' : 'Tambah Akun Cloudflare'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Label</label>
            <input
              className="input"
              placeholder="Contoh: Kerjaan, Pribadi, dll"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Cloudflare Account ID</label>
            <input
              className="input font-mono text-xs"
              placeholder="abc123def456..."
              value={form.account_id}
              onChange={e => setForm({ ...form, account_id: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">R2 Bucket Name</label>
            <input
              className="input font-mono text-xs"
              placeholder="media-kerjaan"
              value={form.bucket}
              onChange={e => setForm({ ...form, bucket: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">R2 API Token {initial && '(biarkan kosong jika tidak diganti)'}</label>
            <input
              type="password"
              className="input font-mono text-xs"
              placeholder={initial ? '********' : 'Masukkan API Token...'}
              value={form.api_token}
              onChange={e => setForm({ ...form, api_token: e.target.value })}
              required={!initial}
            />
          </div>

          <div>
            <label className="label">Folder (pisahkan dengan koma)</label>
            <input
              className="input"
              placeholder="foto, video, dokumen, backup"
              value={form.folders}
              onChange={e => setForm({ ...form, folders: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">Contoh: foto, video, dokumen, backup, arsip</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary flex-1">
              {testing ? 'Mengetes...' : 'Test Koneksi'}
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Menyimpan...' : initial ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>

        <button onClick={onClose} className="mt-4 text-sm text-gray-400 hover:text-gray-600 w-full text-center">
          Batal
        </button>
      </div>
    </div>
  )
}
