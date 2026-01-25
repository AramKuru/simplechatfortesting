import { useState, useEffect, useRef } from 'react'
import { Transmit } from '@adonisjs/transmit-client'
import './Chat.css'

const API_URL = import.meta.env.VITE_API_URL
const PRODUCT_ID = import.meta.env.VITE_PRODUCT_ID

function Chat({ authToken, onLogout }) {
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [streamingMessage, setStreamingMessage] = useState('')
  const messagesEndRef = useRef(null)
  const subscriptionRef = useRef(null)
  const transmitRef = useRef(null)
  const isInitializedRef = useRef(false)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessage])

  // Load existing conversation or create new one
  useEffect(() => {
    // Prevent double initialization (React StrictMode in dev)
    if (isInitializedRef.current) {
      return
    }
    isInitializedRef.current = true

    const savedConversationId = localStorage.getItem('conversationId')

    if (savedConversationId) {
      loadConversation(savedConversationId)
    } else {
      createConversation()
    }

    return () => {
      // Cleanup subscription on unmount
      if (subscriptionRef.current) {
        subscriptionRef.current.delete()
      }
    }
  }, [])

  const createConversation = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/v1/chatbot/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversationType: 'issue',
          productId: parseInt(PRODUCT_ID),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create conversation')
      }

      const convId = data.data.id
      setConversationId(convId)
      localStorage.setItem('conversationId', convId)

      // Connect to Transmit after creating conversation
      await connectTransmit(convId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadConversation = async (convId) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/v1/chatbot/conversations/${convId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // If conversation not found, create new one
        if (response.status === 404) {
          localStorage.removeItem('conversationId')
          createConversation()
          return
        }
        throw new Error(data.message || 'Failed to load conversation')
      }

      setConversationId(convId)
      setMessages(data.data.messages || [])

      // Connect to Transmit
      await connectTransmit(convId)
    } catch (err) {
      setError(err.message)
      // If error loading, try creating new conversation
      localStorage.removeItem('conversationId')
      createConversation()
    } finally {
      setLoading(false)
    }
  }

  const connectTransmit = async (convId) => {
    try {
      // Clean up existing subscription if any
      if (subscriptionRef.current) {
        console.log('Cleaning up existing subscription...')
        await subscriptionRef.current.delete()
        subscriptionRef.current = null
      }

      console.log('Setting up Transmit client for conversation:', convId)

      // Create Transmit client
      const transmit = new Transmit({
        baseUrl: API_URL,
        beforeSubscribe(request) {
          request.headers.set('Authorization', `Bearer ${authToken}`)
        }
      })

      transmitRef.current = transmit

      // Create subscription to conversation channel
      const subscription = transmit.subscription(`chatbot/conversations/${convId}`)

      // Handle incoming messages
      subscription.onMessage((payload) => {
        console.log('Received message:', payload)

        // Handle different message types
        switch (payload.type) {
          case 'user_message':
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(msg => msg.id === payload.data.id)) {
                return prev
              }
              return [...prev, payload.data]
            })
            setStreamingMessage('')
            break

          case 'assistant_chunk':
            console.log(`[${new Date().toISOString()}] Chunk received:`, payload.data.text.length, 'chars')
            setStreamingMessage(prev => prev + payload.data.text)
            break

          case 'assistant_complete':
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(msg => msg.id === payload.data.id)) {
                return prev
              }
              return [...prev, payload.data]
            })
            setStreamingMessage('')
            setStreaming(false)
            break

          case 'done':
            setStreaming(false)
            break

          case 'error':
            setError(payload.data.message)
            setStreaming(false)
            setStreamingMessage('')
            break
        }
      })

      // Subscribe to channel
      await subscription.create()
      console.log('✅ Subscribed to conversation channel:', convId)

      subscriptionRef.current = subscription
    } catch (err) {
      console.error('Failed to connect to Transmit:', err)
      setError('Failed to establish real-time connection')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()

    if (!inputMessage.trim() || streaming || !conversationId) return

    setStreaming(true)
    setError('')
    const messageToSend = inputMessage
    setInputMessage('')

    try {
      const response = await fetch(
        `${API_URL}/api/v1/chatbot/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message: messageToSend,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message')
      }

      // Message will be added via Transmit
    } catch (err) {
      setError(err.message)
      setStreaming(false)
      setInputMessage(messageToSend) // Restore message on error
    }
  }

  const handleNewChat = async () => {
    if (subscriptionRef.current) {
      await subscriptionRef.current.delete()
    }
    localStorage.removeItem('conversationId')
    setConversationId(null)
    setMessages([])
    setStreamingMessage('')
    createConversation()
  }

  if (loading && !conversationId) {
    return (
      <div className="chat-loading">
        <div className="spinner"></div>
        <p>Initializing chat...</p>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <h2>PowerSolid Support Chat</h2>
          <p className="chat-subtitle">Product ID: {PRODUCT_ID}</p>
        </div>
        <div className="chat-actions">
          <button onClick={handleNewChat} className="btn-secondary" disabled={streaming}>
            New Chat
          </button>
          <button onClick={onLogout} className="btn-secondary">
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-btn">×</button>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 && !streamingMessage && (
          <div className="empty-state">
            <h3>Welcome to PowerSolid Support</h3>
            <p>Ask me anything about product #{PRODUCT_ID}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-content">
              <div className="message-role">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="message-text">{msg.content}</div>
              <div className="message-time">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {streamingMessage && (
          <div className="message assistant streaming">
            <div className="message-content">
              <div className="message-role">Assistant</div>
              <div className="message-text">
                {streamingMessage}
                <span className="typing-indicator">▊</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={streaming || !conversationId}
          className="message-input"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || streaming || !conversationId}
          className="btn-send"
        >
          {streaming ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default Chat
