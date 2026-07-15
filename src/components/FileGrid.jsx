function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(1) + ' GB'
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const fileIcons = {
  image: '🖼️',
  video: '🎬',
  pdf: '📕',
  word: '📘',
  excel: '📗',
  text: '📄',
  zip: '📦',
  json: '📋',
  default: '📄',
}

function getFileIcon(mime, filename) {
  if (mime?.startsWith('image/')) return fileIcons.image
  if (mime?.startsWith('video/')) return fileIcons.video
  if (mime === 'application/pdf') return fileIcons.pdf
  if (mime?.includes('word') || filename?.endsWith('.docx') || filename?.endsWith('.doc')) return fileIcons.word
  if (mime?.includes('excel') || mime?.includes('spreadsheet') || filename?.endsWith('.xlsx') || filename?.endsWith('.xls')) return fileIcons.excel
  if (mime?.startsWith('text/')) return fileIcons.text
  if (mime?.includes('zip') || mime?.includes('rar') || mime?.includes('tar') || filename?.endsWith('.zip')) return fileIcons.zip
  if (mime === 'application/json') return fileIcons.json
  return fileIcons.default
}

export default function FileGrid({ files, onPreview, onDelete, onShare, onRename }) {

  const handleRenameClick = (e, file) => {
    e.stopPropagation()
    const oldName = file.filename
    const ext = oldName.includes('.') ? oldName.substring(oldName.lastIndexOf('.')) : ''
    const baseName = ext ? oldName.substring(0, oldName.lastIndexOf('.')) : oldName
    const newName = prompt('Rename file:', baseName)
    if (newName && newName.trim()) {
      onRename?.(file, newName.trim() + ext)
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {files.map(file => {
        const isVideo = file.mime?.startsWith('video/')

        return (
          <div
            key={file.id}
            className="card group cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
            onClick={() => onPreview?.(file)}
          >
            {/* Thumbnail */}
            <div className={`aspect-video relative overflow-hidden ${isVideo ? 'bg-gray-800' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl">{getFileIcon(file.mime, file.filename)}</span>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                {formatSize(file.size)}
              </div>
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className="text-xs font-medium text-gray-900 truncate" title={file.filename}>
                {file.filename}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatSize(file.size)} &middot; {formatDate(file.created_at)}
              </p>
              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                {onRename && (
                  <button
                    onClick={(e) => handleRenameClick(e, file)}
                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 rounded py-1 font-medium text-gray-600"
                  >
                    ✏️ Rename
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={() => onShare(file)}
                    className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 rounded py-1 font-medium text-gray-600"
                  >
                    🔗 Share
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(file)}
                    className="flex-1 text-xs bg-red-50 hover:bg-red-100 rounded py-1 font-medium text-red-600"
                  >
                    🗑️ Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
