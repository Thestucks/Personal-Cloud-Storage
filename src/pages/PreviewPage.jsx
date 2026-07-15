import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

export default function PreviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.getSharedFile(token)
      .then(setFile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm card p-8">
          <p className="text-5xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Tidak Valid</h1>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  const isImage = file.mime?.startsWith('image/')
  const isVideo = file.mime?.startsWith('video/')
  const isPdf = file.mime === 'application/pdf'
  const isText = file.mime?.startsWith('text/')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-900">☁️ CloudStorage</span>
          <a href={file.downloadUrl} download={file.filename} className="btn-primary text-sm">
            ⬇️ Download
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-900 truncate">{file.filename}</h1>
              <p className="text-sm text-gray-400">{formatSize(file.size)}</p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {isImage && (
            <img src={file.downloadUrl} alt={file.filename} className="w-full" />
          )}
          {isVideo && (
            <video controls className="w-full" poster={`https://picsum.photos/seed/${token}/800/450`}>
              <source src={file.downloadUrl} type={file.mime} />
            </video>
          )}
          {isPdf && (
            <iframe src={file.downloadUrl} className="w-full h-[80vh]" title={file.filename} />
          )}
          {isText && (
            <pre className="p-6 text-sm overflow-auto max-h-[80vh] bg-gray-50">
              Isi file teks akan ditampilkan di sini...
            </pre>
          )}
          {!isImage && !isVideo && !isPdf && !isText && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-3">📄</p>
              <p>File siap diunduh</p>
              <a href={file.downloadUrl} download={file.filename} className="btn-primary mt-4 inline-block">
                ⬇️ Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
