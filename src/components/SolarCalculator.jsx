import { useState, useEffect } from 'react'
import './SolarCalculator.css'

function SolarCalculator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calculationData, setCalculationData] = useState(null)
  const [loadInput, setLoadInput] = useState('10')
  const [unitInput, setUnitInput] = useState('kw')

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'

  const calculateSolarSystem = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${apiUrl}/api/v1/solar-calculator/on-grid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            load: parseFloat(loadInput),
            unit: unitInput,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch calculation')
      }

      const result = await response.json()
      setCalculationData(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    calculateSolarSystem()
  }, [])

  const renderSystemCard = (systemName, systemData) => {
    if (!systemData) return null

    const { solarPanel, inverter, totalPrice, calculations } = systemData

    return (
      <div className="system-card" key={systemName}>
        <div className="system-header">
          <h3>{systemName.charAt(0).toUpperCase() + systemName.slice(1)} System</h3>
          <div className="total-price">
            <span className="price-label">Total Price:</span>
            <span className="price-value">${totalPrice.toLocaleString()}</span>
          </div>
        </div>

        <div className="system-content">
          {/* Solar Panel Section */}
          <div className="component-section">
            <h4>Solar Panels</h4>
            <div className="component-details">
              {solarPanel.image && (
                <img
                  src={solarPanel.image.small || solarPanel.image.mid}
                  alt={solarPanel.name}
                  className="product-image"
                />
              )}
              <div className="component-info">
                <p className="component-name">{solarPanel.name}</p>
                <p className="component-sku">SKU: {solarPanel.sku}</p>
                <div className="component-specs">
                  <span>Power Rating: {solarPanel.powerRating}W</span>
                  <span>Quantity: {solarPanel.quantity}</span>
                  <span>Unit Price: ${parseFloat(solarPanel.unitPrice).toFixed(2)}</span>
                </div>
                <div className="component-subtotal">
                  Subtotal: ${solarPanel.subtotal.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Inverter Section */}
          <div className="component-section">
            <h4>Inverter{inverter.inverters.length > 1 ? 's' : ''}</h4>
            <p className="configuration-badge">
              Configuration: {inverter.configuration}
            </p>
            {inverter.inverters.map((inv, index) => (
              <div className="component-details" key={index}>
                {inv.image && (
                  <img
                    src={inv.image.small || inv.image.mid}
                    alt={inv.name}
                    className="product-image"
                  />
                )}
                <div className="component-info">
                  <p className="component-name">{inv.name}</p>
                  <p className="component-sku">SKU: {inv.sku}</p>
                  <div className="component-specs">
                    <span>Power Rating: {inv.powerRating}kW</span>
                    <span>Quantity: {inv.quantity}</span>
                    <span>Unit Price: ${parseFloat(inv.unitPrice).toFixed(2)}</span>
                  </div>
                  <div className="component-subtotal">
                    Subtotal: ${inv.subtotal.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            <div className="inverter-total">
              Total Inverter Cost: ${inverter.subtotal.toLocaleString()}
            </div>
          </div>

          {/* Calculations Section */}
          <div className="calculations-section">
            <h4>System Calculations</h4>
            <div className="calc-grid">
              <div className="calc-item">
                <span className="calc-label">Total Solar Capacity:</span>
                <span className="calc-value">{calculations.totalSolarCapacityKw.toFixed(2)} kW</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Total Inverter Capacity:</span>
                <span className="calc-value">{calculations.totalInverterCapacityKw.toFixed(2)} kW</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Inverter Power Needed:</span>
                <span className="calc-value">{calculations.inverterPowerNeeded.toFixed(2)} kW</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Rounding Method:</span>
                <span className="calc-value">{calculations.roundingMethod}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="solar-calculator-container">
      <header className="calculator-header">
        <h1>On-Grid Solar System Calculator</h1>
        <p>Calculate the best solar system for your needs</p>
      </header>

      <div className="calculator-input-section">
        <div className="input-group">
          <label htmlFor="load">Load:</label>
          <input
            type="number"
            id="load"
            value={loadInput}
            onChange={(e) => setLoadInput(e.target.value)}
            placeholder="Enter load value"
          />
        </div>
        <div className="input-group">
          <label htmlFor="unit">Unit:</label>
          <select
            id="unit"
            value={unitInput}
            onChange={(e) => setUnitInput(e.target.value)}
          >
            <option value="kw">kW (Kilowatts)</option>
            <option value="amps">Amps</option>
          </select>
        </div>
        <button
          onClick={calculateSolarSystem}
          disabled={loading}
          className="calculate-btn"
        >
          {loading ? 'Calculating...' : 'Calculate System'}
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Calculating your solar system...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {calculationData && !loading && (
        <>
          <div className="input-summary">
            <h2>Your Input</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Original Load:</span>
                <span className="summary-value">
                  {calculationData.input.originalLoad} {calculationData.input.originalUnit}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Load (kW):</span>
                <span className="summary-value">{calculationData.input.loadKw} kW</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Load (Amps):</span>
                <span className="summary-value">{calculationData.input.loadAmps.toFixed(2)} A</span>
              </div>
            </div>
          </div>

          <div className="systems-container">
            <h2>Available Systems</h2>
            <div className="systems-grid">
              {renderSystemCard('cheapest', calculationData.systems.cheapest)}
              {renderSystemCard('featured', calculationData.systems.featured)}
              {renderSystemCard('premium', calculationData.systems.premium)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SolarCalculator
