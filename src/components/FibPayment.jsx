import { useState, useEffect, useCallback, useRef } from 'react'
import { Transmit } from '@adonisjs/transmit-client'
import './FibPayment.css'

const API_URL = import.meta.env.VITE_API_URL

function FibPayment({ authToken, onLogout }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cart, setCart] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [selectedAddress, setSelectedAddress] = useState(null)
  const [order, setOrder] = useState(null)
  const [payment, setPayment] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [listening, setListening] = useState(false)
  const [refunding, setRefunding] = useState(false)

  const subscriptionRef = useRef(null)
  const transmitRef = useRef(null)

  // Fetch cart
  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/cart`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setCart(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err)
    }
  }, [authToken])

  // Fetch default address first, then all addresses
  const fetchAddresses = useCallback(async () => {
    try {
      // First try to get the default address
      const defaultResponse = await fetch(`${API_URL}/api/v1/users/me/addresses/default`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      const defaultData = await defaultResponse.json()

      if (defaultData.success && defaultData.data) {
        // Use default address
        setAddresses([defaultData.data])
        setSelectedAddress(defaultData.data.id)
      } else {
        // Fallback: fetch all addresses
        const response = await fetch(`${API_URL}/api/v1/users/me/addresses`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          setAddresses(data.data)
          // Auto-select the default one or first
          const defaultAddr = data.data.find((addr) => addr.isDefault)
          setSelectedAddress(defaultAddr ? defaultAddr.id : data.data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err)
    }
  }, [authToken])

  // Fetch payment status with retry for canRefund field
  // Handles race condition where order status isn't updated yet
  const fetchPaymentWithRetry = useCallback(
    async (paymentId, maxRetries = 5, initialDelay = 100) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(`${API_URL}/api/v1/payments/${paymentId}/status`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          })
          const data = await response.json()

          if (data.success) {
            console.log(`Payment fetch attempt ${attempt + 1}:`, {
              canRefund: data.data.canRefund,
              status: data.data.status,
            })

            // If canRefund is true OR this is the last attempt, use this data
            if (data.data.canRefund || attempt === maxRetries - 1) {
              setPayment(data.data)
              return data.data
            }

            // canRefund is false and we have retries left - wait and retry
            const delay = initialDelay * Math.pow(2, attempt)
            console.log(`canRefund is false, retrying in ${delay}ms...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        } catch (err) {
          console.error(`Failed to fetch payment (attempt ${attempt + 1}):`, err)
          if (attempt === maxRetries - 1) {
            throw err
          }
        }
      }
    },
    [authToken]
  )

  // Subscribe to payment status via SSE
  const subscribeToPaymentStatus = useCallback(
    async (paymentId) => {
      try {
        // Clean up existing subscription
        if (subscriptionRef.current) {
          await subscriptionRef.current.delete()
          subscriptionRef.current = null
        }

        console.log('Setting up SSE for payment:', paymentId)

        // Create Transmit client
        const transmit = new Transmit({
          baseUrl: API_URL,
          beforeSubscribe(request) {
            request.headers.set('Authorization', `Bearer ${authToken}`)
          },
        })
        transmitRef.current = transmit

        // Subscribe to payment status channel
        const channel = `payments/${paymentId}/status`
        const subscription = transmit.subscription(channel)

        subscription.onMessage(async (message) => {
          console.log('SSE Payment status update:', message)

          const { type, payload } = message

          if (type === 'payment_completed') {
            setPaymentStatus('completed')
            setListening(false)
            fetchCart() // Refresh cart (should be empty now)

            // Fetch updated payment details with retry (handles race condition)
            try {
              await fetchPaymentWithRetry(paymentId)
            } catch (err) {
              console.error('Failed to fetch updated payment details:', err)
            }
          } else if (type === 'payment_failed') {
            setPaymentStatus('failed')
            setListening(false)
          } else if (type === 'payment_status_changed') {
            // Handle intermediate status changes
            if (payload?.status) {
              setPaymentStatus(payload.status)
            }
          }
        })

        await subscription.create()
        subscriptionRef.current = subscription

        // Set listening after successful subscription
        console.log('SSE Subscribed to payment channel:', channel)
        setListening(true)
      } catch (err) {
        console.error('Failed to subscribe to payment status:', err)
        // Fallback to polling if SSE fails
        startPolling(paymentId)
      }
    },
    [authToken, fetchCart, fetchPaymentWithRetry]
  )

  // Fallback polling (if SSE fails)
  const startPolling = useCallback(
    (paymentId) => {
      console.log('Falling back to polling for payment:', paymentId)
      setListening(true)

      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_URL}/api/v1/payments/${paymentId}/status`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          })
          const data = await response.json()
          if (data.success) {
            const status = data.data.status
            setPaymentStatus(status)

            if (status === 'completed' || status === 'failed' || status === 'refunded') {
              clearInterval(pollInterval)
              setListening(false)

              if (status === 'completed') {
                fetchCart()
                // Use retry mechanism to get canRefund field
                try {
                  await fetchPaymentWithRetry(paymentId)
                } catch (err) {
                  console.error('Failed to fetch payment with retry:', err)
                  setPayment(data.data) // Fallback to current data
                }
              } else {
                setPayment(data.data)
              }
            }
          }
        } catch (err) {
          console.error('Failed to poll payment status:', err)
        }
      }, 3000)

      // Store interval ID for cleanup
      subscriptionRef.current = { delete: () => clearInterval(pollInterval) }
    },
    [authToken, fetchCart, fetchPaymentWithRetry]
  )

  // Create order with FIB payment
  const createOrder = async () => {
    if (!selectedAddress) {
      setError('Please select a delivery address')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          deliveryAddressId: selectedAddress,
          paymentMethod: 'fib',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order')
      }
      setOrder(data.data.order)
      setPayment(data.data.payment)
      setPaymentStatus('processing')

      // Subscribe to payment status via SSE
      await subscribeToPaymentStatus(data.data.payment.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchCart()
    fetchAddresses()
  }, [fetchCart, fetchAddresses])

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.delete()
      }
    }
  }, [])

  // Reset to shopping mode
  const resetOrder = async () => {
    // Cleanup subscription
    if (subscriptionRef.current) {
      await subscriptionRef.current.delete()
      subscriptionRef.current = null
    }
    setOrder(null)
    setPayment(null)
    setPaymentStatus(null)
    setListening(false)
    fetchCart()
  }

  // Request refund for completed payment
  const requestRefund = async () => {
    if (!window.confirm('Are you sure you want to cancel and refund this payment?')) {
      return
    }

    setRefunding(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/v1/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process refund')
      }
      setPaymentStatus('refunded')
      setPayment(data.data)
      fetchCart() // Cart items should be restored
    } catch (err) {
      setError(err.message)
    } finally {
      setRefunding(false)
    }
  }

  // Render payment page
  if (payment && order) {
    // FIB payment links are under fibPayment (from serializer)
    const fibPayment = payment.fibPayment || {}

    return (
      <div className="fib-payment-container">
        <div className="payment-header">
          <h1>FIB Payment</h1>
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="payment-card">
          <div className="order-summary">
            <h2>Order #{order.orderNumber}</h2>
            <p className="order-amount">Amount: {order.totalAmount} IQD</p>
            <p className={`payment-status status-${paymentStatus}`}>
              Status: {paymentStatus?.toUpperCase()}
            </p>
          </div>

          {paymentStatus === 'pending' || paymentStatus === 'processing' ? (
            <div className="payment-options">
              <h3>Pay with FIB App</h3>

              {fibPayment.qrCode && (
                <div className="qr-section">
                  <p>Scan QR Code with FIB App:</p>
                  <img
                    src={fibPayment.qrCode}
                    alt="FIB Payment QR Code"
                    className="qr-code"
                  />
                </div>
              )}

              {fibPayment.readableCode && (
                <div className="readable-code-section">
                  <p>Or enter this code in FIB QuickPay:</p>
                  <div className="readable-code">{fibPayment.readableCode}</div>
                </div>
              )}

              <div className="app-links">
                {fibPayment.personalAppLink && (
                  <a
                    href={fibPayment.personalAppLink}
                    className="btn-fib-app"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open FIB Personal App
                  </a>
                )}
                {fibPayment.businessAppLink && (
                  <a
                    href={fibPayment.businessAppLink}
                    className="btn-fib-app btn-business"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open FIB Business App
                  </a>
                )}
              </div>

              {fibPayment.validUntil && (
                <p className="expires-at">
                  Expires at: {new Date(fibPayment.validUntil).toLocaleString()}
                </p>
              )}

              {listening && (
                <div className="polling-indicator">
                  <div className="spinner"></div>
                  <span>Waiting for payment...</span>
                </div>
              )}
            </div>
          ) : paymentStatus === 'completed' ? (
            <div className="payment-success">
              <div className="success-icon">✓</div>
              <h3>Payment Successful!</h3>
              <p>Your order has been confirmed.</p>
              <div className="success-actions">
                <button className="btn-primary" onClick={resetOrder}>
                  Make Another Order
                </button>
                {payment.canRefund && (
                  <button
                    className="btn-refund"
                    onClick={requestRefund}
                    disabled={refunding}
                  >
                    {refunding ? 'Processing...' : 'Cancel & Refund'}
                  </button>
                )}
              </div>
              {payment.canRefund && payment.refundDeadline && (
                <p className="refund-deadline">
                  Refund available until: {new Date(payment.refundDeadline).toLocaleString()}
                </p>
              )}
            </div>
          ) : paymentStatus === 'refunded' ? (
            <div className="payment-refunded">
              <div className="refunded-icon">↩</div>
              <h3>Payment Refunded</h3>
              <p>Your payment has been refunded and cart items restored.</p>
              <button className="btn-primary" onClick={resetOrder}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="payment-failed">
              <div className="failed-icon">✕</div>
              <h3>Payment Failed</h3>
              <p>The payment was not completed. Your cart items have been restored.</p>
              <button className="btn-primary" onClick={resetOrder}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render checkout page
  return (
    <div className="fib-payment-container">
      <div className="payment-header">
        <h1>FIB Payment Test</h1>
        <button className="btn-logout" onClick={onLogout}>
          Logout
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="checkout-container">
        <div className="cart-section">
          <h2>Your Cart</h2>
          {!cart || !cart.items || cart.items.length === 0 ? (
            <p className="empty-message">Your cart is empty</p>
          ) : (
            <>
              <div className="cart-items">
                {cart.items.map((item) => (
                  <div key={item.id} className="cart-item">
                    <span className="item-name">
                      {item.product?.name || item.bundle?.name || `Item #${item.id}`}
                    </span>
                    <span className="item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="cart-total">
                <span>Total:</span>
                <span>{cart.totalAmount || cart.itemsSubtotal} IQD</span>
              </div>

              {/* Address Selection */}
              <div className="address-section">
                <h3>Delivery Address</h3>
                {addresses.length === 0 ? (
                  <p className="empty-message">No addresses found. Please add an address first.</p>
                ) : (
                  <select
                    value={selectedAddress || ''}
                    onChange={(e) => setSelectedAddress(Number(e.target.value))}
                    className="address-select"
                  >
                    {addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label || addr.addressLine} - {addr.city?.name || addr.subcity?.name || ''}
                        {addr.isDefault ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                className="btn-checkout"
                onClick={createOrder}
                disabled={loading || !selectedAddress}
              >
                {loading ? 'Processing...' : 'Pay with FIB'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FibPayment
