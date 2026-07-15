import { useState, useRef, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAccounts } from '../hooks/useAccounts'
import { api } from '../lib/api'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

export default function UploadPage() {
  const [searchParams] = useSearchParams()
  const preselectedAccount = searchParams.get('account')
  const preselectedFolder = searchParams.get('folder')

  const { accounts } = useAccounts()
  const [selectedAccount, setSelectedAccount] = useState(preselectedAccount || '')
  const [selectedFolder, setSelectedFolder] = useState(preselectedFolder || '')
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const inputRef = useRef(null)

  const currentAccount = accounts.find(a => a.id === Number(selectedAccount))
  const folders = currentAccount?.folders || []

  useEffect(() => {
    if (preselectedFolder && folders.length > 0 && !selectedFolder) {
      setSelectedFolder(preselectedFolder)
    }
  }, [folders, preselectedFolder, selectedFolder])

  useEffect(() => {
    if (preselectedAccount && accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(preselectedAccount)
    }
  }, [accounts, preselectedAccount, selectedAccount])

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList)
    setFiles(prev => [...prev, ...arr])
    setDone(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleUpload = async () => {
    if (!selectedAccount || !selectedFolder || files.length === 0) return
    setUploading(true)
    setProgress(0)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const { uploadUrl } = await api.getPresignedUrl(
          selectedAccount, selectedFolder, file.name, file.type || 'application/octet-stream'
        )
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: file.type ? { 'Content-Type': file.type } : {},
        })
      } catch (e) {
        alert(`Gagal upload ${file.name}: ${e.message}`)
      }
      setProgress(((i + 1) / files.length) * 100)
    }

    setUploading(false)
    setDone(true)
  }

  const reset = () => {
    setFiles([])
    setProgress(0)
    setDone(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Upload</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">📤 Upload File</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`card p-8 text-center cursor-pointer transition-colors ${
              files.length > 0 ? 'border-primary-300 bg-primary-50/30' : 'hover:bg-gray-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <p className="text-5xl mb-3">📥</p>
            <p className="text-gray-600 font-medium">Drop file di sini atau klik untuk pilih</p>
            <p className="text-xs text-gray-400 mt-1">File foto, video, dokumen, dan lainnya</p>
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium text-gray-900 mb-3">File dipilih ({files.length})</h3>
              <div className="space-y-2 max-h-60 overflow-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{getIcon(f.name)}</span>
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-gray-400 text-xs">{formatSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="card p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Mengupload...</span>
                <span className="text-gray-500">{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="card p-4 border-green-200 bg-green-50">
              <p className="text-green-700 font-medium">✅ Upload berhasil!</p>
              <p className="text-sm text-green-600 mt-1">{files.length} file telah diupload.</p>
              <button onClick={reset} className="btn-secondary mt-3 text-sm">Upload Lagi</button>
            </div>
          )}
        </div>

        {/* Right: options */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-medium text-gray-900 mb-3">Upload ke</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Akun Cloudflare</label>
                <select
                  className="input"
                  value={selectedAccount}
                  onChange={e => { setSelectedAccount(e.target.value); setSelectedFolder('') }}
                >
                  <option value="">Pilih akun...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Folder tujuan</label>
                <select
                  className="input"
                  value={selectedFolder}
                  onChange={e => setSelectedFolder(e.target.value)}
                  disabled={!selectedAccount}
                >
                  <option value="">Pilih folder...</option>
                  {folders.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedAccount || !selectedFolder || files.length === 0}
                className="btn-primary w-full"
              >
                {uploading ? 'Mengupload...' : `Upload ${files.length > 0 ? `(${files.length} file)` : ''}`}
              </button>
            </div>
          </div>

          <div className="card p-4 text-xs text-gray-400">
            <p className="font-medium text-gray-600 mb-1">💡 Informasi</p>
            <p>File diupload langsung ke Cloudflare R2 via presigned URL. Server tidak menyimpan file.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function getIcon(name) {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) return '🖼️'
  if (/\.(mp4|webm|mov|avi)$/i.test(name)) return '🎬'
  if (/\.pdf$/i.test(name)) return '📕'
  if (/\.(doc|docx)$/i.test(name)) return '📘'
  if (/\.(xls|xlsx)$/i.test(name)) return '📗'
  if (/\.(txt|json|csv|log)$/i.test(name)) return '📄'
  if (/\.(zip|rar|tar|gz)$/i.test(name)) return '📦'
  return '📄'
}
