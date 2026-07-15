import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useFiles(accountId, folder) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!accountId || !folder) return
    setLoading(true)
    try {
      const data = await api.getFiles(accountId, folder)
      setFiles(data)
    } finally {
      setLoading(false)
    }
  }, [accountId, folder])

  useEffect(() => { fetch() }, [fetch])

  return { files, loading, refetch: fetch }
}
