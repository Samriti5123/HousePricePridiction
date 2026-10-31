/**
 * Bengaluru House Price Prediction - Frontend Client
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // State & Cache
  // -------------------------------------------------------------------------
  let appState = {
    locations: [],
    areaTypes: [],
    classes: ['Low', 'Medium', 'High'],
    thresholds: { Low_Max: 55.0, Medium_Max: 93.0 },
    presets: []
  };

  // -------------------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------------------
  const elements = {
    apiStatusBadge: document.getElementById('apiStatusBadge'),
    apiStatusText: document.getElementById('apiStatusText'),
    locCountBadge: document.getElementById('locCountBadge'),
    locationInput: document.getElementById('locationInput'),
    btnClearLoc: document.getElementById('btnClearLoc'),
    autocompleteDropdown: document.getElementById('autocompleteDropdown'),
    quickLocsContainer: document.getElementById('quickLocs'),
    presetsContainer: document.getElementById('presetsContainer'),
    predictionForm: document.getElementById('predictionForm'),
    btnSubmit: document.getElementById('btnSubmit'),
    btnText: document.querySelector('.btn-text'),
    btnLoader: document.querySelector('.btn-loader'),
    
    // Inputs
    totalSqft: document.getElementById('totalSqft'),
    sqftSlider: document.getElementById('sqftSlider'),
    sqftDisplay: document.getElementById('sqftDisplay'),
    bhkInput: document.getElementById('bhkInput'),
    bathInput: document.getElementById('bathInput'),
    bhkGroup: document.getElementById('bhkGroup'),
    bathGroup: document.getElementById('bathGroup'),
    areaTypeContainer: document.getElementById('areaTypeContainer'),

    // Result Containers
    emptyState: document.getElementById('emptyState'),
    resultsContent: document.getElementById('resultsContent'),

    // Regression Results
    predictedPriceNumber: document.getElementById('predictedPriceNumber'),
    predictedPriceUnit: document.getElementById('predictedPriceUnit'),
    formattedInrDisplay: document.getElementById('formattedInrDisplay'),
    pricePerSqftDisplay: document.getElementById('pricePerSqftDisplay'),
    roomDensityDisplay: document.getElementById('roomDensityDisplay'),
    bathBedRatioDisplay: document.getElementById('bathBedRatioDisplay'),

    // Classification Results
    tierBadge: document.getElementById('tierBadge'),
    tierDesc: document.getElementById('tierDesc'),
    probLow: document.getElementById('probLow'),
    barLow: document.getElementById('barLow'),
    probMedium: document.getElementById('probMedium'),
    barMedium: document.getElementById('barMedium'),
    probHigh: document.getElementById('probHigh'),
    barHigh: document.getElementById('barHigh'),
    priceMarker: document.getElementById('priceMarker'),

    // Advisory & Insights
    advisoryAlert: document.getElementById('advisoryAlert'),
    advisoryList: document.getElementById('advisoryList'),
    evaluatedLocationSpan: document.getElementById('evaluatedLocationSpan'),
    evaluatedAreaTypeSpan: document.getElementById('evaluatedAreaTypeSpan'),

    // Modal
    btnModelInfo: document.getElementById('btnModelInfo'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    modelModal: document.getElementById('modelModal')
  };

  // -------------------------------------------------------------------------
  // Initialize Application
  // -------------------------------------------------------------------------
  async function init() {
    bindEvents();
    await fetchMetadata();
    // Run an initial sample valuation so user immediately sees results
    setTimeout(() => {
      runPrediction();
    }, 400);
  }

  // -------------------------------------------------------------------------
  // Fetch API Metadata
  // -------------------------------------------------------------------------
  async function fetchMetadata() {
    try {
      const res = await fetch('/api/metadata');
      if (!res.ok) throw new Error('Failed to load metadata');
      const data = await res.json();
      
      appState.locations = data.locations || [];
      appState.areaTypes = data.area_types || [];
      appState.classes = data.classes || ['Low', 'Medium', 'High'];
      appState.thresholds = data.thresholds || { Low_Max: 55.0, Medium_Max: 93.0 };
      appState.presets = data.presets || [];

      // Update UI Status
      elements.apiStatusBadge.classList.add('online');
      elements.apiStatusText.textContent = 'API Connected';
      elements.locCountBadge.textContent = `${appState.locations.length} Localities`;

      // Set default location if empty
      if (!elements.locationInput.value) {
        elements.locationInput.value = data.default_location || 'Whitefield';
        elements.btnClearLoc.style.display = 'block';
      }

      // Populate Presets
      renderPresets();

    } catch (err) {
      console.warn('Metadata fetch error:', err);
      elements.apiStatusText.textContent = 'API Offline';
      elements.locCountBadge.textContent = 'Local Mode';
      elements.locations = ['Whitefield', 'Electronic City Phase II', 'Indira Nagar', 'HSR Layout', 'Koramangala', 'other'];
    }
  }

  // -------------------------------------------------------------------------
  // Render Preset Buttons
  // -------------------------------------------------------------------------
  function renderPresets() {
    elements.presetsContainer.innerHTML = '';
    appState.presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip';
      btn.innerHTML = `<span>${preset.name}</span>`;
      btn.addEventListener('click', () => {
        applyPreset(preset.data);
      });
      elements.presetsContainer.appendChild(btn);
    });
  }

  function applyPreset(data) {
    elements.totalSqft.value = data.total_sqft;
    elements.sqftSlider.value = Math.min(data.total_sqft, elements.sqftSlider.max);
    updateSqftDisplay(data.total_sqft);

    // BHK
    elements.bhkInput.value = data.bhk;
    setActivePill(elements.bhkGroup, data.bhk);

    // Bath
    elements.bathInput.value = data.bath;
    setActivePill(elements.bathGroup, data.bath);

    // Location
    elements.locationInput.value = data.location;
    elements.btnClearLoc.style.display = 'block';

    // Area Type
    const radio = document.querySelector(`input[name="area_type"][value="${data.area_type}"]`);
    if (radio) {
      radio.checked = true;
      updateAreaTypeStyles();
    }

    // Auto submit prediction
    runPrediction();
  }

  // -------------------------------------------------------------------------
  // Autocomplete Locality Combobox
  // -------------------------------------------------------------------------
  let activeAutocompleteIndex = -1;

  function filterLocations(query) {
    const q = query.trim().toLowerCase();
    if (!q) return appState.locations.slice(0, 15);
    return appState.locations.filter(loc => loc.toLowerCase().includes(q)).slice(0, 20);
  }

  function renderAutocomplete(items, query) {
    if (!items.length) {
      elements.autocompleteDropdown.innerHTML = '<div class="autocomplete-item"><em>No exact match - will use \'other\' cluster</em></div>';
      elements.autocompleteDropdown.classList.remove('hidden');
      return;
    }

    const q = query.trim().toLowerCase();
    elements.autocompleteDropdown.innerHTML = items.map((loc, idx) => {
      let label = loc;
      if (q) {
        const matchStart = loc.toLowerCase().indexOf(q);
        if (matchStart !== -1) {
          const matched = loc.substr(matchStart, q.length);
          label = loc.substring(0, matchStart) + `<span class="match">${matched}</span>` + loc.substring(matchStart + q.length);
        }
      }
      return `<div class="autocomplete-item" data-index="${idx}" data-value="${loc}">${label}</div>`;
    }).join('');

    elements.autocompleteDropdown.classList.remove('hidden');
    activeAutocompleteIndex = -1;
  }

  function selectLocation(val) {
    elements.locationInput.value = val;
    elements.autocompleteDropdown.classList.add('hidden');
    elements.btnClearLoc.style.display = val ? 'block' : 'none';
  }

  // -------------------------------------------------------------------------
  // Event Bindings
  // -------------------------------------------------------------------------
  function bindEvents() {
    // Location input search
    elements.locationInput.addEventListener('input', (e) => {
      const val = e.target.value;
      elements.btnClearLoc.style.display = val ? 'block' : 'none';
      const filtered = filterLocations(val);
      renderAutocomplete(filtered, val);
    });

    elements.locationInput.addEventListener('focus', () => {
      const val = elements.locationInput.value;
      const filtered = filterLocations(val);
      renderAutocomplete(filtered, val);
    });

    elements.btnClearLoc.addEventListener('click', () => {
      elements.locationInput.value = '';
      elements.btnClearLoc.style.display = 'none';
      elements.locationInput.focus();
      renderAutocomplete(filterLocations(''), '');
    });

    // Keyboard navigation in autocomplete
    elements.locationInput.addEventListener('keydown', (e) => {
      const items = elements.autocompleteDropdown.querySelectorAll('.autocomplete-item');
      if (elements.autocompleteDropdown.classList.contains('hidden') || !items.length) {
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          runPrediction();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex + 1) % items.length;
        highlightAutocompleteItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeAutocompleteIndex = (activeAutocompleteIndex - 1 + items.length) % items.length;
        highlightAutocompleteItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeAutocompleteIndex >= 0 && items[activeAutocompleteIndex]) {
          const val = items[activeAutocompleteIndex].getAttribute('data-value');
          if (val) selectLocation(val);
        } else {
          elements.autocompleteDropdown.classList.add('hidden');
        }
      } else if (e.key === 'Escape') {
        elements.autocompleteDropdown.classList.add('hidden');
      }
    });

    elements.autocompleteDropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (item && item.getAttribute('data-value')) {
        selectLocation(item.getAttribute('data-value'));
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.combobox-wrapper')) {
        elements.autocompleteDropdown.classList.add('hidden');
      }
    });

    // Quick locality chips
    elements.quickLocsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.loc-chip');
      if (chip && chip.dataset.loc) {
        selectLocation(chip.dataset.loc);
      }
    });

    // Sqft input & slider synchronization
    elements.totalSqft.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      elements.sqftSlider.value = Math.min(val, elements.sqftSlider.max);
      updateSqftDisplay(val);
    });

    elements.sqftSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      elements.totalSqft.value = val;
      updateSqftDisplay(val);
    });

    // Quick adjust step buttons (-100, +100, +500)
    document.querySelectorAll('.btn-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.dataset.step, 10);
        let current = parseFloat(elements.totalSqft.value) || 1200;
        current = Math.max(300, current + step);
        elements.totalSqft.value = current;
        elements.sqftSlider.value = Math.min(current, elements.sqftSlider.max);
        updateSqftDisplay(current);
      });
    });

    // BHK pills
    elements.bhkGroup.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn');
      if (pill) {
        const val = parseInt(pill.dataset.val, 10);
        elements.bhkInput.value = val;
        setActivePill(elements.bhkGroup, val);
      }
    });

    // Bath pills
    elements.bathGroup.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn');
      if (pill) {
        const val = parseInt(pill.dataset.val, 10);
        elements.bathInput.value = val;
        setActivePill(elements.bathGroup, val);
      }
    });

    // Area type radio changes
    elements.areaTypeContainer.addEventListener('change', () => {
      updateAreaTypeStyles();
    });

    // Form submission
    elements.predictionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      runPrediction();
    });

    // Global shortcut Ctrl+Enter
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        runPrediction();
      }
    });

    // Modal Architecture Dialog
    elements.btnModelInfo.addEventListener('click', () => {
      elements.modelModal.classList.remove('hidden');
    });

    elements.btnCloseModal.addEventListener('click', () => {
      elements.modelModal.classList.add('hidden');
    });

    elements.modelModal.addEventListener('click', (e) => {
      if (e.target === elements.modelModal) {
        elements.modelModal.classList.add('hidden');
      }
    });
  }

  function highlightAutocompleteItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeAutocompleteIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function setActivePill(container, val) {
    container.querySelectorAll('.pill-btn').forEach(btn => {
      if (parseInt(btn.dataset.val, 10) === parseInt(val, 10)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateSqftDisplay(val) {
    elements.sqftDisplay.textContent = `${Math.round(val).toLocaleString()} sq.ft`;
  }

  function updateAreaTypeStyles() {
    document.querySelectorAll('#areaTypeContainer .seg-item').forEach(item => {
      const radio = item.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // -------------------------------------------------------------------------
  // Run Prediction via FastAPI Backend
  // -------------------------------------------------------------------------
  async function runPrediction() {
    const totalSqft = parseFloat(elements.totalSqft.value);
    const bhk = parseFloat(elements.bhkInput.value);
    const bath = parseFloat(elements.bathInput.value);
    const location = elements.locationInput.value.trim() || 'Whitefield';
    const checkedArea = document.querySelector('input[name="area_type"]:checked');
    const areaType = checkedArea ? checkedArea.value : 'Super built-up  Area';

    if (!totalSqft || totalSqft <= 0) {
      alert('Please enter a valid built-up area in sq.ft.');
      elements.totalSqft.focus();
      return;
    }

    setLoading(true);

    const payload = {
      total_sqft: totalSqft,
      bhk: bhk,
      bath: bath,
      location: location,
      area_type: areaType
    };

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to compute prediction');
      }

      const result = await response.json();
      displayResults(result);

    } catch (err) {
      console.error('Prediction failed:', err);
      alert(`Error calculating valuation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (isLoading) {
      elements.btnSubmit.disabled = true;
      elements.btnText.classList.add('hidden');
      elements.btnLoader.classList.remove('hidden');
    } else {
      elements.btnSubmit.disabled = false;
      elements.btnText.classList.remove('hidden');
      elements.btnLoader.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------------------
  // Display Prediction Results
  // -------------------------------------------------------------------------
  function displayResults(data) {
    elements.emptyState.classList.add('hidden');
    elements.resultsContent.classList.remove('hidden');

    // 1. Regression Section
    const lakhs = data.predicted_price_lakhs;
    if (lakhs >= 100) {
      elements.predictedPriceNumber.textContent = (lakhs / 100).toFixed(2);
      elements.predictedPriceUnit.textContent = 'Crores';
    } else {
      elements.predictedPriceNumber.textContent = lakhs.toFixed(2);
      elements.predictedPriceUnit.textContent = 'Lakhs';
    }

    elements.formattedInrDisplay.textContent = data.formatted_inr;
    elements.pricePerSqftDisplay.textContent = data.formatted_price_per_sqft;
    elements.roomDensityDisplay.textContent = `${data.sqft_per_bhk} sq.ft / BHK`;
    elements.bathBedRatioDisplay.textContent = (data.input_received.bath / data.input_received.bhk).toFixed(1);

    // 2. Classification Section
    const category = data.predicted_category; // "Low", "Medium", "High"
    elements.tierBadge.textContent = category;
    elements.tierBadge.className = 'tier-indicator';

    if (category === 'Low') {
      elements.tierBadge.classList.add('tier-low');
      elements.tierDesc.textContent = 'Budget / Affordable Housing Tier (≤ ₹55 Lakhs)';
    } else if (category === 'Medium') {
      elements.tierBadge.classList.add('tier-medium');
      elements.tierDesc.textContent = 'Mid-Market Residential Tier (₹55L – ₹93L)';
    } else {
      elements.tierBadge.classList.add('tier-high');
      elements.tierDesc.textContent = 'Premium / Luxury Residential Tier (> ₹93 Lakhs)';
    }

    // Probability Bars
    const probs = data.category_probabilities || {};
    const lowP = probs['Low'] || 0;
    const medP = probs['Medium'] || 0;
    const highP = probs['High'] || 0;

    elements.probLow.textContent = `${lowP}%`;
    elements.barLow.style.width = `${lowP}%`;

    elements.probMedium.textContent = `${medP}%`;
    elements.barMedium.style.width = `${medP}%`;

    elements.probHigh.textContent = `${highP}%`;
    elements.barHigh.style.width = `${highP}%`;

    // Boundary guide marker (0 to 180 lakhs range)
    const markerPercent = Math.min(Math.max((lakhs / 150) * 100, 4), 96);
    elements.priceMarker.style.left = `${markerPercent}%`;

    // 3. Outlier / Advisory Alert
    if (data.warnings && data.warnings.length > 0) {
      elements.advisoryList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join('');
      elements.advisoryAlert.classList.remove('hidden');
    } else {
      elements.advisoryAlert.classList.add('hidden');
    }

    // 4. Feature Summary
    elements.evaluatedLocationSpan.textContent = data.input_received.location;
    elements.evaluatedAreaTypeSpan.textContent = data.input_received.area_type.trim();
  }

  // Run start
  init();
});
