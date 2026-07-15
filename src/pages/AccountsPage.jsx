import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts } from '../hooks/useAccounts'
import { api } from '../lib/api'
import AccountForm from '../components/AccountForm'

function formatBytes(bytes) {
  if (bytes === 0) return '0 GB'
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

export default function AccountsPage() {
  const { accounts, loading, refetch } = useAccounts()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [testing, setTesting] = useState(null)

  const handleDelete = async (id) => {
    if (!confirm('Hapus akun ini? File tidak bisa dikembalikan.')) return
    await api.deleteAccount(id)
    refetch()
  }

  const handleTest = async (acct) => {
    setTesting(acct.id)
    try {
      const res = await api.testConnection({ id: acct.id })
      alert(res.message)
    } catch (e) {
      alert('Gagal: ' + e.message)
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Akun Cloudflare</h1>
          <p className="text-sm text-gray-500 mt-1">{accounts.length} akun terdaftar</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="btn-primary">
          + Tambah Akun
        </button>
      </div>

      <div className="space-y-3">
        {accounts.map(acct => {
          const pct = acct.usage.total > 0
            ? Math.min((acct.usage.used / acct.usage.total) * 100, 100)
            : 0

          return (
            <div key={acct.id} className="card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{acct.label}</h3>
                    <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Aktif</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {acct.account_id.substring(0, 8)}... / {acct.bucket}
                  </p>
                </div>

                <div className="sm:w-48">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{formatBytes(acct.usage.used)}</span>
                    <span>{formatBytes(acct.usage.total)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-primary-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(acct)}
                    disabled={testing === acct.id}
                    className="btn-ghost text-xs"
                  >
                    {testing === acct.id ? '...' : 'Test'}
                  </button>
                  <button
                    onClick={() => { setEditing(acct); setShowForm(true) }}
                    className="btn-ghost text-xs"
                  >
                    Edit
                  </button>
                  <Link to={`/accounts/${acct.id}`} className="btn-ghost text-xs">
                    Detail
                  </Link>
                  <button
                    onClick={() => handleDelete(acct.id)}
                    className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {accounts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">☁️</p>
            <p>Belum ada akun Cloudflare</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
              + Tambah Akun
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); refetch() }}
        />
      )}
    </div>
  )
}
