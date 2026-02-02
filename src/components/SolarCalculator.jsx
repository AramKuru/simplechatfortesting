import { useState, useEffect } from 'react'
import './SolarCalculator.css'

function SolarCalculator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calculationData, setCalculationData] = useState(null)

  // System type: 'on-grid' or 'hybrid'
  const [systemType, setSystemType] = useState('on-grid')

  // On-grid inputs
  const [loadInput, setLoadInput] = useState('10')
  const [unitInput, setUnitInput] = useState('kw')
  const [phaseInput, setPhaseInput] = useState('single-phase')

  // Hybrid inputs
  const [dayLoadInput, setDayLoadInput] = useState('5')
  const [nightLoadInput, setNightLoadInput] = useState('3')
  const [nightHoursInput, setNightHoursInput] = useState('8')
  const [batteryTypeInput, setBatteryTypeInput] = useState('lithium')

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3333'

  const calculateSolarSystem = async () => {
    setLoading(true)
    setError(null)

    try {
      let endpoint, payload

      if (systemType === 'on-grid') {
        endpoint = `${apiUrl}/api/v1/solar-calculator/on-grid`
        payload = {
          load: parseFloat(loadInput),
          unit: unitInput,
          phase: phaseInput,
        }
      } else {
        endpoint = `${apiUrl}/api/v1/solar-calculator/hybrid`
        payload = {
          dayLoad: parseFloat(dayLoadInput),
          nightLoad: parseFloat(nightLoadInput),
          nightHours: parseFloat(nightHoursInput),
          batteryType: batteryTypeInput,
          unit: unitInput,
          phase: phaseInput,
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.message || `Server error: ${response.status}`
        throw new Error(errorMessage)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Calculation failed')
      }

      setCalculationData(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    calculateSolarSystem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isValidInput = () => {
    if (systemType === 'on-grid') {
      return loadInput && parseFloat(loadInput) >= 0.1
    }
    return (
      dayLoadInput && parseFloat(dayLoadInput) >= 0.1 &&
      nightLoadInput && parseFloat(nightLoadInput) >= 0.1 &&
      nightHoursInput && parseFloat(nightHoursInput) >= 1
    )
  }

  const renderBatterySection = (battery) => {
    if (!battery) return null

    return (
      <div className="component-section">
        <h4>Battery</h4>
        <p className="configuration-badge">
          Type: {battery.batteryType} | {battery.seriesCount} in series × {battery.parallelSets} parallel
        </p>
        <div className="component-details">
          {battery.image && (
            <img
              src={battery.image.small || battery.image.mid}
              alt={battery.name}
              className="product-image"
            />
          )}
          <div className="component-info">
            <p className="component-name">{battery.name}</p>
            <p className="component-sku">SKU: {battery.sku}</p>
            <div className="component-specs">
              <span>Power Rating: {battery.powerRating}kW</span>
              <span>Voltage: {battery.voltage}V</span>
              <span>Required Qty: {battery.requiredQuantity}</span>
              {battery.optionalQuantity !== null && (
                <span>Optional Qty: {battery.optionalQuantity}</span>
              )}
              <span>Unit Price: ${parseFloat(battery.unitPrice).toFixed(2)}</span>
            </div>
            <div className="component-specs">
              <span>Required Runtime: {battery.requiredRuntime}h</span>
              {battery.optionalRuntime !== null && (
                <span>Optional Runtime: {battery.optionalRuntime}h</span>
              )}
            </div>
            {battery.addedForInverterCompatibility > 0 && (
              <p className="battery-note">
                +{battery.addedForInverterCompatibility} battery(ies) added for inverter compatibility
              </p>
            )}
            <div className="component-subtotal">
              Subtotal: ${battery.subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSystemCard = (systemName, systemData) => {
    if (!systemData) return null

    const { solarPanel, inverter, battery, totalPrice, calculations } = systemData
    const isHybrid = systemType === 'hybrid'

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
            {isHybrid && (
              <p className="configuration-badge">
                Day: {solarPanel.daySolarCount} | Night: {solarPanel.nightSolarCount} | Total: {solarPanel.totalSolarCount}
              </p>
            )}
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
                  <span>Quantity: {isHybrid ? solarPanel.totalSolarCount : solarPanel.quantity}</span>
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
            <h4>Inverter{inverter.inverters?.length > 1 ? 's' : ''}</h4>
            <p className="configuration-badge">
              Configuration: {inverter.configuration}
            </p>
            {inverter.inverters?.map((inv, index) => (
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
                    {inv.ipClass && <span>IP Class: {inv.ipClass}</span>}
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

          {/* Battery Section (Hybrid only) */}
          {isHybrid && renderBatterySection(battery)}

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
              {isHybrid ? (
                <>
                  <div className="calc-item">
                    <span className="calc-label">Day Rounding:</span>
                    <span className="calc-value">{calculations.dayRoundingMethod}</span>
                  </div>
                  <div className="calc-item">
                    <span className="calc-label">Night Rounding:</span>
                    <span className="calc-value">{calculations.nightRoundingMethod}</span>
                  </div>
                  <div className="calc-item">
                    <span className="calc-label">Inverter Charge Hours:</span>
                    <span className="calc-value">{calculations.hoursInverterCanSupport}h</span>
                  </div>
                </>
              ) : (
                <div className="calc-item">
                  <span className="calc-label">Rounding Method:</span>
                  <span className="calc-value">{calculations.roundingMethod}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderInputSummary = () => {
    if (!calculationData) return null

    if (systemType === 'on-grid') {
      return (
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
              <span className="summary-label">Phase:</span>
              <span className="summary-value">
                {calculationData.input.phase === 'single-phase' ? 'Single-Phase (230V)' : 'Three-Phase (400V)'}
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
      )
    }

    // Hybrid summary
    return (
      <div className="input-summary">
        <h2>Your Input</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Day Load:</span>
            <span className="summary-value">{calculationData.input.dayLoadKw} kW</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Night Load:</span>
            <span className="summary-value">{calculationData.input.nightLoadKw} kW</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Night Hours:</span>
            <span className="summary-value">{calculationData.input.nightHours}h</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Battery Type:</span>
            <span className="summary-value" style={{ textTransform: 'capitalize' }}>
              {calculationData.input.batteryType}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Phase:</span>
            <span className="summary-value">
              {calculationData.input.phase === 'single-phase' ? 'Single-Phase (230V)' : 'Three-Phase (400V)'}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Unit:</span>
            <span className="summary-value" style={{ textTransform: 'uppercase' }}>
              {calculationData.input.unit}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="solar-calculator-container">
      <header className="calculator-header">
        <h1>Solar System Calculator</h1>
        <p>Calculate the best solar system for your needs</p>
      </header>

      <div className="calculator-input-section">
        {/* System Type Toggle */}
        <div className="input-group">
          <label htmlFor="systemType">System Type:</label>
          <select
            id="systemType"
            value={systemType}
            onChange={(e) => {
              setSystemType(e.target.value)
              setCalculationData(null)
            }}
          >
            <option value="on-grid">On-Grid (No Battery)</option>
            <option value="hybrid">Hybrid (With Battery)</option>
          </select>
        </div>

        {systemType === 'on-grid' ? (
          /* On-Grid Inputs */
          <div className="input-group">
            <label htmlFor="load">Load:</label>
            <input
              type="number"
              id="load"
              value={loadInput}
              onChange={(e) => setLoadInput(e.target.value)}
              placeholder="Enter load value"
              min="0.1"
              step="0.1"
              required
            />
          </div>
        ) : (
          /* Hybrid Inputs */
          <>
            <div className="input-group">
              <label htmlFor="dayLoad">Day Load:</label>
              <input
                type="number"
                id="dayLoad"
                value={dayLoadInput}
                onChange={(e) => setDayLoadInput(e.target.value)}
                placeholder="Day load"
                min="0.1"
                step="0.1"
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="nightLoad">Night Load:</label>
              <input
                type="number"
                id="nightLoad"
                value={nightLoadInput}
                onChange={(e) => setNightLoadInput(e.target.value)}
                placeholder="Night load"
                min="0.1"
                step="0.1"
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="nightHours">Night Hours:</label>
              <input
                type="number"
                id="nightHours"
                value={nightHoursInput}
                onChange={(e) => setNightHoursInput(e.target.value)}
                placeholder="Hours"
                min="1"
                step="1"
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="batteryType">Battery Type:</label>
              <select
                id="batteryType"
                value={batteryTypeInput}
                onChange={(e) => setBatteryTypeInput(e.target.value)}
              >
                <option value="lithium">Lithium</option>
                <option value="tubular">Tubular</option>
              </select>
            </div>
          </>
        )}

        <div className="input-group">
          <label htmlFor="phase">Phase:</label>
          <select
            id="phase"
            value={phaseInput}
            onChange={(e) => {
              setPhaseInput(e.target.value)
              // Reset to kW when switching to three-phase
              if (e.target.value === 'three-phase') {
                setUnitInput('kw')
              }
            }}
          >
            <option value="single-phase">Single-Phase (230V)</option>
            <option value="three-phase">Three-Phase (400V)</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="unit">Unit:</label>
          <select
            id="unit"
            value={unitInput}
            onChange={(e) => setUnitInput(e.target.value)}
            disabled={phaseInput === 'three-phase'}
          >
            <option value="kw">kW (Kilowatts)</option>
            <option value="amps" disabled={phaseInput === 'three-phase'}>
              Amps {phaseInput === 'three-phase' ? '(N/A for 3-phase)' : ''}
            </option>
          </select>
        </div>

        <button
          onClick={calculateSolarSystem}
          disabled={loading || !isValidInput()}
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
          {renderInputSummary()}

          <div className="systems-container">
            <h2>Available Systems</h2>
            {!calculationData.systems.cheapest &&
            !calculationData.systems.featured &&
            !calculationData.systems.premium ? (
              <div className="no-systems-message">
                <p>No solar systems available for the requested load.</p>
                <p>Please try a different load value or contact support.</p>
              </div>
            ) : (
              <div className="systems-grid">
                {renderSystemCard('cheapest', calculationData.systems.cheapest)}
                {renderSystemCard('featured', calculationData.systems.featured)}
                {renderSystemCard('premium', calculationData.systems.premium)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default SolarCalculator
