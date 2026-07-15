import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function SharePage() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLinks = async () => {
    setLoading(true)
    try {
      const data = await api.getShareLinks()
      setLinks(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLinks() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Hapus share link? File tetap ada.')) return
    await api.deleteShareLink(id)
    fetchLinks()
  }

  const copyLink = (token) => {
    const url = `${window.location.origin}${window.location.pathname}#/share/${token}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Link disalin!')
    })
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🔗 Share Link</h1>

      {links.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">🔗</p>
          <p>Belum ada share link</p>
          <p className="text-sm mt-1">Buka file dan klik "Share" untuk membuat link</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div key={link.id} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{link.filename}</p>
                  <p className="text-xs text-gray-400">
                    {link.account_label} &middot; Dibuat {formatDate(link.created_at)}
                    {link.downloads > 0 && ` &middot; ${link.downloads} download`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(link.expires) > new Date() ? '⏳ Berlaku hingga ' : '❌ Kadaluwarsa '}
                    {formatDate(link.expires)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyLink(link.token)}
                    className="btn-secondary text-xs"
                  >
                    📋 Salin Link
                  </button>
                  <Link
                    to={`/share/${link.token}`}
                    className="btn-secondary text-xs"
                  >
                    🔍 Lihat
                  </Link>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
