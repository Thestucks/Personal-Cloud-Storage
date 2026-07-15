import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AccountsPage from './pages/AccountsPage'
import AccountDetail from './pages/AccountDetail'
import BrowsePage from './pages/BrowsePage'
import UploadPage from './pages/UploadPage'
import SharePage from './pages/SharePage'
import PreviewPage from './pages/PreviewPage'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
        <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
        <Route path="/browse/:accountId" element={<ProtectedRoute><BrowsePage /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/share" element={<ProtectedRoute><SharePage /></ProtectedRoute>} />
        <Route path="/preview/:accountId/:fileId" element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
        <Route path="/share/:token" element={<PreviewPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
