import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getAccounts()
      setAccounts(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { accounts, loading, error, refetch: fetch }
}

export function useAccount(id) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getAccount(id).then(setAccount).finally(() => setLoading(false))
  }, [id])

  return { account, loading }
}

export function useAccountUsage(id) {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    if (!id) return
    api.getAccountUsage(id).then(setUsage)
  }, [id])

  return usage
}
