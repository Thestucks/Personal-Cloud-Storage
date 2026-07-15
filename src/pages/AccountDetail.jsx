import { useParams, Link } from 'react-router-dom'
import { useAccount } from '../hooks/useAccounts'
import FolderManager from '../components/FolderManager'

function formatBytes(bytes) {
  if (bytes === 0) return '0 GB'
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB'
}

export default function AccountDetail() {
  const { id } = useParams()
  const { account, loading } = useAccount(id)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">😕</p>
        <p>Akun tidak ditemukan</p>
        <Link to="/accounts" className="btn-primary mt-4 inline-block">Kembali</Link>
      </div>
    )
  }

  const pct = account.usage.total > 0
    ? Math.min((account.usage.used / account.usage.total) * 100, 100)
    : 0

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/accounts" className="hover:text-gray-600">Akun</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{account.label}</span>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{account.label}</h1>
            <p className="text-sm text-gray-400 mt-1 font-mono">
              ID: {account.account_id}
            </p>
            <p className="text-sm text-gray-400 font-mono">
              Bucket: {account.bucket}
            </p>
          </div>

          <div className="sm:w-56">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>{formatBytes(account.usage.used)}</span>
              <span>{formatBytes(account.usage.total)}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-primary-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-right mt-1">{account.files} file</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/browse/${account.id}?folder=foto`} className="btn-secondary text-sm">
            📁 Jelajahi File
          </Link>
          <Link to={`/upload?account=${account.id}`} className="btn-primary text-sm">
            📤 Upload
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">📁 Folder</h2>
        <FolderManager accountId={account.id} />
      </div>
    </div>
  )
}
