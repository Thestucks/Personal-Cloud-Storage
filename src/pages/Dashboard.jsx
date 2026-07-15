import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts } from '../hooks/useAccounts'
import { api } from '../lib/api'

function formatBytes(bytes) {
  if (bytes === 0) return '0 GB'
  const gb = bytes / (1024 ** 3)
  return gb.toFixed(1) + ' GB'
}

function AccountCard({ account }) {
  const usage = account.usage || { used: 0, total: 10_737_418_240, files: 0 }
  const total = usage.total || 10_737_418_240
  const pct = total > 0 ? Math.min((usage.used / total) * 100, 100) : 0

  return (
    <Link to={`/accounts/${account.id}`} className="card p-5 hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{account.label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{usage.files || 0} file</p>
        </div>
        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
          Aktif
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Storage</span>
          <span>{formatBytes(usage.used)} / {formatBytes(total)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-primary-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-4">
        {account.folders?.map(f => (
          <Link
            key={f}
            to={`/browse/${account.id}?folder=${f}`}
            onClick={e => e.stopPropagation()}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors"
          >
            📁 {f}
          </Link>
        ))}
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { accounts, loading } = useAccounts()
  const [usageMap, setUsageMap] = useState({})
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')

  useEffect(() => {
    if (accounts.length === 0) return
    setUsageLoading(true)
    setUsageError('')
    Promise.all(accounts.map(a =>
      api.getAccountUsage(a.id)
        .then(u => ({ id: a.id, usage: u }))
        .catch(() => null)
    )).then(results => {
      const map = {}
      results.filter(Boolean).forEach(r => { map[r.id] = r.usage })
      setUsageMap(map)
      setUsageLoading(false)
    })
  }, [accounts])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  const accountsWithUsage = accounts.map(a => ({
    ...a,
    usage: usageMap[a.id] || a.usage || { used: 0, total: 10_737_418_240, files: 0 },
  }))

  const totalUsed = accountsWithUsage.reduce((s, a) => s + (a.usage.used || 0), 0)
  const totalFiles = accountsWithUsage.reduce((s, a) => s + (a.usage.files || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {accounts.length} akun &middot; {formatBytes(totalUsed)} terpakai &middot; {totalFiles} file
            {usageLoading && <span className="ml-2 text-xs text-gray-400">(memuat...)</span>}
          </p>
        </div>
        <Link to="/accounts" className="btn-primary">+ Tambah Akun</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountsWithUsage.map(acct => (
          <AccountCard key={acct.id} account={acct} />
        ))}
      </div>
    </div>
  )
}
