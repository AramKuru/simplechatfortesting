import { useState, useEffect } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import SolarCalculator from './components/SolarCalculator'
import FibPayment from './components/FibPayment'
import './App.css'

function Navigation({ currentPage, authToken }) {
  return (
    <nav className="app-nav">
      <a href="#/" className="nav-brand">
        PowerSolid
      </a>
      <div className="nav-links">
        <a
          href="#/"
          className={`nav-link ${currentPage === 'chat' ? 'active' : ''}`}
        >
          AI Chat
        </a>
        <a
          href="#/solar-calculator"
          className={`nav-link ${currentPage === 'solar-calculator' ? 'active' : ''}`}
        >
          Solar Calculator
        </a>
        {authToken && (
          <a
            href="#/order"
            className={`nav-link ${currentPage === 'order' ? 'active' : ''}`}
          >
            Orders
          </a>
        )}
      </div>
    </nav>
  )
}

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
      } else if (hash === '/order' || hash === '/fib-payment') {
        setCurrentPage('order')
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

  const renderContent = () => {
    // Solar calculator page (public, no auth required)
    if (currentPage === 'solar-calculator') {
      return <SolarCalculator />
    }

    // Order/FIB Payment page (requires auth)
    if (currentPage === 'order') {
      return !authToken ? (
        <Login onLogin={handleLogin} />
      ) : (
        <FibPayment authToken={authToken} onLogout={handleLogout} />
      )
    }

    // Chat/Login pages (existing functionality)
    return !authToken ? (
      <Login onLogin={handleLogin} />
    ) : (
      <Chat authToken={authToken} onLogout={handleLogout} />
    )
  }

  return (
    <div className="app">
      <Navigation currentPage={currentPage} authToken={authToken} />
      <div className="app-content">
        {renderContent()}
      </div>
    </div>
  )
}

export default App
