import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAccount } from '../hooks/useAccounts'
import { useFiles } from '../hooks/useFiles'
import { api } from '../lib/api'
import FileGrid from '../components/FileGrid'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

export default function BrowsePage() {
  const { accountId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const folder = searchParams.get('folder') || ''
  const { account, loading: acctLoading } = useAccount(accountId)
  const { files, loading: filesLoading, refetch } = useFiles(accountId, folder)
  const [previewFile, setPreviewFile] = useState(null)

  const handleShare = async (file) => {
    if (!file?.id) return
    const link = await api.createShareLink(file.id, 7)
    alert(`Link berhasil dibuat:\n${window.location.origin}/#/share/${link.token}`)
  }

  const handleRename = async (file, newName) => {
    if (!file?.id) return
    await api.renameFile(accountId, file.id, newName, file.r2_key)
    refetch()
  }

  const handleDelete = async (file) => {
    if (!file?.id) return
    if (!confirm(`Hapus "${file.filename}"?`)) return
    await api.deleteFile(file.id, accountId, file.r2_key)
    refetch()
  }

  if (acctLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const folders = account?.folders || []

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <span>/</span>
        <Link to={`/accounts/${accountId}`} className="hover:text-gray-600">{account?.label || 'Akun'}</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{folder || 'Semua File'}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {account?.label} — {folder || 'Semua File'}
        </h1>
        <Link to={`/upload?account=${accountId}&folder=${folder}`} className="btn-primary">
          📤 Upload
        </Link>
      </div>

      {/* Folder tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {folders.map(f => (
          <button
            key={f}
            onClick={() => setSearchParams({ folder: f })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              folder === f
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📁 {f}
          </button>
        ))}
      </div>

      {/* File grid */}
      {filesLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">📂</p>
          <p className="text-lg">Belum ada file di folder ini</p>
          <Link to={`/upload?account=${accountId}&folder=${folder}`} className="btn-primary mt-4 inline-block">
            Upload File Pertama
          </Link>
        </div>
      ) : (
        <FileGrid
          files={files}
          onPreview={setPreviewFile}
          onDelete={handleDelete}
          onShare={handleShare}
          onRename={handleRename}
        />
      )}

      {/* Preview modal */}
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  )
}

function PreviewModal({ file, onClose }) {
  const { accountId } = useParams()
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isImage = file.mime?.startsWith('image/')
  const isVideo = file.mime?.startsWith('video/')
  const isPdf = file.mime === 'application/pdf'
  const isText = file.mime?.startsWith('text/')

  useEffect(() => {
    if (!file?.r2_key || !accountId) return
    setLoading(true)
    api.getPreviewUrl(accountId, file.r2_key)
      .then(res => { setPreviewUrl(res.previewUrl); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [file?.r2_key, accountId])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 truncate">{file.filename}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
          )}
          {error && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-5xl mb-3">⚠️</p>
              <p>Gagal memuat preview: {error}</p>
            </div>
          )}
          {!loading && !error && isImage && previewUrl && (
            <img src={previewUrl} alt={file.filename} className="w-full rounded-lg" />
          )}
          {!loading && !error && isVideo && previewUrl && (
            <video controls className="w-full rounded-lg" poster={previewUrl}>
              <source src={previewUrl} type={file.mime} />
            </video>
          )}
          {!loading && !error && isPdf && previewUrl && (
            <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg" title={file.filename} />
          )}
          {!loading && !error && isText && (
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-[60vh]">
              {`Isi file ${file.filename}\n(Langsung download untuk membaca)`}
            </pre>
          )}
          {!loading && !isImage && !isVideo && !isPdf && !isText && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-5xl mb-3">📄</p>
              <p>Preview tidak tersedia untuk tipe file ini</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
