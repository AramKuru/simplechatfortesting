import { useState, useEffect } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import SolarCalculator from './components/SolarCalculator'
import './App.css'

function App() {
  const [authToken, setAuthToken] = useState(null)
  const [currentPage, setCurrentPage] = useState('chat')

  // Check for saved token on mount and handle routing
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    if (savedToken) {
      setAuthToken(savedToken)
    }

    // Simple hash-based routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash === '/solar-calculator' || hash === '/api/v1/solar-calculator/on-grid') {
        setCurrentPage('solar-calculator')
      } else {
        setCurrentPage('chat')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const handleLogin = (token) => {
    setAuthToken(token)
    localStorage.setItem('authToken', token)
  }

  const handleLogout = () => {
    setAuthToken(null)
    localStorage.removeItem('authToken')
    localStorage.removeItem('conversationId')
  }

  // Solar calculator page (public, no auth required)
  if (currentPage === 'solar-calculator') {
    return (
      <div className="app">
        <SolarCalculator />
      </div>
    )
  }

  // Chat/Login pages (existing functionality)
  return (
    <div className="app">
      {!authToken ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Chat authToken={authToken} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
