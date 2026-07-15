import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function FolderManager({ accountId }) {
  const [folders, setFolders] = useState([])
  const [newFolder, setNewFolder] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    api.getFolders(accountId).then(data => {
      setFolders(data)
      setLoading(false)
    })
  }, [accountId])

  const handleAdd = async () => {
    const name = newFolder.trim().toLowerCase().replace(/\s+/g, '_')
    if (!name) return
    try {
      const updated = await api.addFolder(accountId, name)
      setFolders(updated)
      setNewFolder('')
    } catch (e) {
      alert(e.message)
    }
  }

  const handleRenameStart = (oldName) => {
    setEditing(oldName)
    setEditValue(oldName)
  }

  const handleRename = async (oldName) => {
    const newName = editValue.trim().toLowerCase().replace(/\s+/g, '_')
    if (!newName || newName === oldName) {
      setEditing(null)
      return
    }
    try {
      const updated = await api.renameFolder(accountId, oldName, newName)
      setFolders(updated)
      setEditing(null)
    } catch (e) {
      alert(e.message)
    }
  }

  const handleDelete = async (name) => {
    if (!confirm(`Hapus folder "${name}"?`)) return
    const updated = await api.deleteFolder(accountId, name)
    setFolders(updated)
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Memuat folder...</div>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {folders.map(f => (
          <div key={f} className="flex items-center gap-1 bg-gray-100 px-2 py-1.5 rounded-full text-sm text-gray-700">
            {editing === f ? (
              <input
                className="w-28 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-sm outline-none focus:border-primary-500"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(f)
                  if (e.key === 'Escape') setEditing(null)
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span>📁 {f}</span>
                <button onClick={() => handleRenameStart(f)} className="text-gray-400 hover:text-blue-500 ml-0.5">
                  ✏️
                </button>
              </>
            )}
            <button onClick={() => handleDelete(f)} className="text-gray-400 hover:text-red-500 ml-0.5">
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Nama folder baru"
          value={newFolder}
          onChange={e => setNewFolder(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} className="btn-primary">Tambah</button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Spasi akan diganti underscore. Folder bisa dihapus (file tetap ada).</p>
    </div>
  )
}
