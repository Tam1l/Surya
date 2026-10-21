/**
 * AuraWings Luxury Aviation — Client Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // State Management
  // =========================================================================
  const state = {
    currentCurrency: 'INR',
    currencyRates: {
      INR: 1,
      USD: 0.012,
      EUR: 0.011,
      GBP: 0.0095,
      AED: 0.044,
      JPY: 1.85
    },
    currencySymbols: {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      AED: 'AED ',
      JPY: '¥'
    },
    searchParams: {
      tripType: 'roundtrip',
      origin: 'DEL',
      destination: 'LHR',
      departDate: '',
      returnDate: '',
      adults: 1,
      children: 0,
      cabinClass: 'economy',
      directOnly: false,
      refundableOnly: false
    },
    currentFlights: [],
    selectedFlight: null,
    selectedSeat: null,
    selectedAddons: {
      baggage: false,
      lounge: true,
      insurance: false,
      carbon: false
    },
    passengerDetails: {},
    bookings: JSON.parse(localStorage.getItem('aura_flight_bookings') || '[]'),
    activeStep: 1,
    filterSettings: {
      stops: 'all',
      maxPrice: 250000,
      airlines: ['Aura Elite Airways', 'SkyStream Express', 'Zenith Global', 'Oceanic Jetways'],
      timeSlot: 'all',
      sortBy: 'recommended'
    }
  };

  // Set default departure & return dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 8);

  const formatDateYMD = (d) => d.toISOString().split('T')[0];
  const depInput = document.getElementById('departureDate');
  const retInput = document.getElementById('returnDate');
  
  if (depInput) {
    depInput.value = formatDateYMD(tomorrow);
    depInput.min = formatDateYMD(today);
  }
  if (retInput) {
    retInput.value = formatDateYMD(nextWeek);
    retInput.min = formatDateYMD(tomorrow);
  }

  // =========================================================================
  // Airport & Airline Data
  // =========================================================================
  const airports = {
    DEL: { code: 'DEL', city: 'New Delhi', name: "Indira Gandhi Int'l", country: 'India', terminal: 'T3' },
    BOM: { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji', country: 'India', terminal: 'T2' },
    BLR: { code: 'BLR', city: 'Bengaluru', name: "Kempegowda Int'l", country: 'India', terminal: 'T2' },
    DXB: { code: 'DXB', city: 'Dubai', name: "Dubai Int'l", country: 'UAE', terminal: 'T3' },
    LHR: { code: 'LHR', city: 'London', name: 'Heathrow Airport', country: 'United Kingdom', terminal: 'T2' },
    JFK: { code: 'JFK', city: 'New York', name: 'John F. Kennedy', country: 'United States', terminal: 'T4' },
    SIN: { code: 'SIN', city: 'Singapore', name: 'Changi Airport', country: 'Singapore', terminal: 'T3' },
    HND: { code: 'HND', city: 'Tokyo', name: 'Haneda Airport', country: 'Japan', terminal: 'T3' },
    CDG: { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France', terminal: 'T2E' },
    SYD: { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'Australia', terminal: 'T1' }
  };

  // =========================================================================
  // Currency Utility
  // =========================================================================
  function formatMoney(amountInINR) {
    const rate = state.currencyRates[state.currentCurrency] || 1;
    const symbol = state.currencySymbols[state.currentCurrency] || '₹';
    const converted = Math.round(amountInINR * rate);
    return `${symbol}${converted.toLocaleString()}`;
  }

  function updateCurrencyAcrossPage() {
    // Update destination cards
    document.querySelectorAll('.currency-price').forEach(el => {
      const usdVal = parseFloat(el.getAttribute('data-usd'));
      if (usdVal) {
        const inrBase = usdVal * 83.2;
        el.textContent = formatMoney(inrBase);
      }
    });

    // Update filter max price badge
    const maxPriceLabel = document.getElementById('maxPriceLabel');
    if (maxPriceLabel) {
      maxPriceLabel.textContent = formatMoney(state.filterSettings.maxPrice);
    }

    // Re-render flight cards if currently searching
    if (state.currentFlights.length > 0) {
      renderFlightCards();
    }

    // Update checkout totals if modal open
    if (state.selectedFlight) {
      updateOrderSummary();
    }
  }

  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      state.currentCurrency = e.target.value;
      updateCurrencyAcrossPage();
      showToast(`Currency changed to ${state.currentCurrency}`, 'info');
    });
  }

  // =========================================================================
  // Search Form & Passenger Controls
  // =========================================================================
  const tripTabs = document.querySelectorAll('.trip-tab');
  const returnDateGroup = document.getElementById('returnDateGroup');

  tripTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tripTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.searchParams.tripType = tab.getAttribute('data-type');
      if (returnDateGroup) {
        if (state.searchParams.tripType === 'oneway') {
          returnDateGroup.style.opacity = '0.4';
          retInput.disabled = true;
        } else {
          returnDateGroup.style.opacity = '1';
          retInput.disabled = false;
        }
      }
    });
  });

  // Swap Locations
  const swapBtn = document.getElementById('swapLocationsBtn');
  const originSelect = document.getElementById('originInput');
  const destSelect = document.getElementById('destInput');

  if (swapBtn && originSelect && destSelect) {
    swapBtn.addEventListener('click', () => {
      const temp = originSelect.value;
      originSelect.value = destSelect.value;
      destSelect.value = temp;
    });
  }

  // Travelers Popover
  const travelersTrigger = document.getElementById('travelersTrigger');
  const travelersDropdown = document.getElementById('travelersDropdown');
  const travelersDisplay = document.getElementById('travelersDisplay');
  const applyTravelersBtn = document.getElementById('applyTravelersBtn');
  const adultsCountEl = document.getElementById('adultsCount');
  const childrenCountEl = document.getElementById('childrenCount');
  const cabinClassSelect = document.getElementById('cabinClassSelect');

  let tempAdults = 1;
  let tempChildren = 0;

  if (travelersTrigger && travelersDropdown) {
    travelersTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      travelersDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!travelersDropdown.contains(e.target) && e.target !== travelersTrigger) {
        travelersDropdown.classList.remove('show');
      }
    });
  }

  document.getElementById('incAdults')?.addEventListener('click', () => {
    if (tempAdults < 9) {
      tempAdults++;
      adultsCountEl.textContent = tempAdults;
    }
  });

  document.getElementById('decAdults')?.addEventListener('click', () => {
    if (tempAdults > 1) {
      tempAdults--;
      adultsCountEl.textContent = tempAdults;
    }
  });

  document.getElementById('incChildren')?.addEventListener('click', () => {
    if (tempChildren < 6) {
      tempChildren++;
      childrenCountEl.textContent = tempChildren;
    }
  });

  document.getElementById('decChildren')?.addEventListener('click', () => {
    if (tempChildren > 0) {
      tempChildren--;
      childrenCountEl.textContent = tempChildren;
    }
  });

  applyTravelersBtn?.addEventListener('click', () => {
    state.searchParams.adults = tempAdults;
    state.searchParams.children = tempChildren;
    state.searchParams.cabinClass = cabinClassSelect.value;

    const totalPax = tempAdults + tempChildren;
    const paxText = totalPax === 1 ? '1 Adult' : `${totalPax} Travelers`;
    const cabinName = cabinClassSelect.options[cabinClassSelect.selectedIndex].text;
    travelersDisplay.textContent = `${paxText}, ${cabinName}`;
    travelersDropdown.classList.remove('show');
  });

  // =========================================================================
  // Flight Generation Algorithm
  // =========================================================================
  function generateMockFlights(originCode, destCode, cabinClass) {
    const airlines = [
      { name: 'Aura Elite Airways', code: 'AU', classPrefix: 'aura-flagship', logoClass: 'aura-logo', rating: 4.9, flagship: true },
      { name: 'SkyStream Express', code: 'SK', classPrefix: '', logoClass: 'skystream-logo', rating: 4.7, flagship: false },
      { name: 'Zenith Global', code: 'ZN', classPrefix: '', logoClass: 'zenith-logo', rating: 4.8, flagship: false },
      { name: 'Oceanic Jetways', code: 'OJ', classPrefix: '', logoClass: 'oceanic-logo', rating: 4.6, flagship: false }
    ];

    const aircrafts = [
      'Boeing 787-9 Dreamliner',
      'Airbus A350-1000',
      'Boeing 777-300ER',
      'Airbus A330-900neo'
    ];

    // Base price matrix roughly calibrated
    let baseRoutePrice = 38000;
    if ((originCode === 'DEL' && destCode === 'DXB') || (originCode === 'DXB' && destCode === 'DEL')) {
      baseRoutePrice = 24000;
    } else if (originCode === 'JFK' || destCode === 'JFK' || originCode === 'SYD' || destCode === 'SYD') {
      baseRoutePrice = 62000;
    }

    // Cabin class multiplier
    let classMultiplier = 1;
    if (cabinClass === 'premium') classMultiplier = 1.45;
    if (cabinClass === 'business') classMultiplier = 2.8;
    if (cabinClass === 'first') classMultiplier = 4.6;

    const flights = [
      {
        id: 'FL-001',
        airline: airlines[0],
        flightNumber: 'AU-804',
        aircraft: aircrafts[0],
        departTime: '02:45 AM',
        arriveTime: '07:30 AM',
        departs24: 2.75,
        durationMinutes: 525,
        durationFormatted: '8h 45m',
        isDirect: true,
        stopsText: 'NON-STOP',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 1.05),
        amenities: ['Starlink Wi-Fi', 'Michelin In-Seat Dining', 'Lie-Flat SkyBed', '2x 32kg Bags']
      },
      {
        id: 'FL-002',
        airline: airlines[1],
        flightNumber: 'SK-214',
        aircraft: aircrafts[1],
        departTime: '06:15 AM',
        arriveTime: '11:45 AM',
        departs24: 6.25,
        durationMinutes: 570,
        durationFormatted: '9h 30m',
        isDirect: true,
        stopsText: 'NON-STOP',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 0.92),
        amenities: ['Complimentary Wi-Fi', 'Hot Meals Included', '4K Entertainment', '2x 23kg Bags']
      },
      {
        id: 'FL-003',
        airline: airlines[2],
        flightNumber: 'ZN-552',
        aircraft: aircrafts[2],
        departTime: '10:30 AM',
        arriveTime: '07:15 PM',
        departs24: 10.5,
        durationMinutes: 645,
        durationFormatted: '10h 45m',
        isDirect: false,
        stopsText: '1 STOP • 1h 40m DXB',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 0.82),
        amenities: ['In-flight Wi-Fi', 'Multi-course Dining', 'USB-C Fast Power', '1x 30kg Bag']
      },
      {
        id: 'FL-004',
        airline: airlines[0],
        flightNumber: 'AU-918',
        aircraft: aircrafts[0],
        departTime: '01:45 PM',
        arriveTime: '06:30 PM',
        departs24: 13.75,
        durationMinutes: 525,
        durationFormatted: '8h 45m',
        isDirect: true,
        stopsText: 'NON-STOP',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 1.15),
        amenities: ['Ultra-Speed Wi-Fi', 'Champagne Bar', 'Designer Amenity Kit', 'Priority Baggage']
      },
      {
        id: 'FL-005',
        airline: airlines[3],
        flightNumber: 'OJ-109',
        aircraft: aircrafts[3],
        departTime: '07:20 PM',
        arriveTime: '02:00 AM',
        departs24: 19.33,
        durationMinutes: 580,
        durationFormatted: '9h 40m',
        isDirect: true,
        stopsText: 'NON-STOP',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 0.88),
        amenities: ['In-Seat Power', 'Complimentary Beverages', 'Ergonomic Seats', '2x 23kg Bags']
      },
      {
        id: 'FL-006',
        airline: airlines[1],
        flightNumber: 'SK-702',
        aircraft: aircrafts[1],
        departTime: '11:10 PM',
        arriveTime: '08:45 AM',
        departs24: 23.16,
        durationMinutes: 695,
        durationFormatted: '11h 35m',
        isDirect: false,
        stopsText: '1 STOP • 2h 10m DOH',
        basePriceINR: Math.round(baseRoutePrice * classMultiplier * 0.78),
        amenities: ['Wi-Fi Enabled', 'Hot Breakfast', 'Noise-Cancelling Audio', 'Standard Baggage']
      }
    ];

    return flights;
  }

  // =========================================================================
  // Flight Search Trigger
  // =========================================================================
  const flightSearchForm = document.getElementById('flightSearchForm');
  const resultsSection = document.getElementById('resultsSection');
  const flightCardsContainer = document.getElementById('flightCardsContainer');

  if (flightSearchForm) {
    flightSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeFlightSearch();
    });
  }

  function executeFlightSearch() {
    const origin = originSelect.value;
    const dest = destSelect.value;

    if (origin === dest) {
      showToast('Origin and Destination airports cannot be identical.', 'warning');
      return;
    }

    state.searchParams.origin = origin;
    state.searchParams.destination = dest;
    state.searchParams.departDate = depInput.value;
    state.searchParams.returnDate = retInput.value;
    state.searchParams.directOnly = document.getElementById('directFlightsOnly').checked;

    // Update Results Header Summary
    const originData = airports[origin] || { city: origin, code: origin };
    const destData = airports[dest] || { city: dest, code: dest };

    document.getElementById('summaryOriginCity').textContent = originData.city;
    document.getElementById('summaryOriginCode').textContent = originData.code;
    document.getElementById('summaryDestCity').textContent = destData.city;
    document.getElementById('summaryDestCode').textContent = destData.code;
    
    document.getElementById('summaryDepartDateText').textContent = new Date(state.searchParams.departDate).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    const totalPax = state.searchParams.adults + state.searchParams.children;
    document.getElementById('summaryPassengersText').textContent = totalPax === 1 ? '1 Passenger' : `${totalPax} Passengers`;

    const cabinNames = {
      economy: 'Economy Class',
      premium: 'Premium Economy',
      business: 'Business Class',
      first: 'First Class'
    };
    document.getElementById('summaryCabinText').textContent = cabinNames[state.searchParams.cabinClass] || 'Economy Class';

    // Generate Flights
    state.currentFlights = generateMockFlights(origin, dest, state.searchParams.cabinClass);

    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderFlightCards();
    showToast(`Found ${state.currentFlights.length} flights for your route!`, 'success');
  }

  // Modify Search CTA
  document.getElementById('modifySearchBtn')?.addEventListener('click', () => {
    document.getElementById('searchSection').scrollIntoView({ behavior: 'smooth' });
  });

  // =========================================================================
  // Filtering & Sorting Logic
  // =========================================================================
  const priceSlider = document.getElementById('priceRangeSlider');
  const maxPriceLabel = document.getElementById('maxPriceLabel');
  const sortBySelect = document.getElementById('sortBySelect');
  const timeSlotButtons = document.querySelectorAll('.time-slot-btn');
  const stopsRadios = document.querySelectorAll('input[name="stopsFilter"]');
  const airlineCheckboxes = document.querySelectorAll('.airline-filter-checkbox');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  if (priceSlider) {
    priceSlider.addEventListener('input', (e) => {
      state.filterSettings.maxPrice = parseInt(e.target.value);
      maxPriceLabel.textContent = formatMoney(state.filterSettings.maxPrice);
      renderFlightCards();
    });
  }

  stopsRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.filterSettings.stops = e.target.value;
      renderFlightCards();
    });
  });

  airlineCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      state.filterSettings.airlines = Array.from(airlineCheckboxes)
        .filter(c => c.checked)
        .map(c => c.value);
      renderFlightCards();
    });
  });

  timeSlotButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timeSlotButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterSettings.timeSlot = btn.getAttribute('data-slot');
      renderFlightCards();
    });
  });

  if (sortBySelect) {
    sortBySelect.addEventListener('change', (e) => {
      state.filterSettings.sortBy = e.target.value;
      renderFlightCards();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      state.filterSettings.stops = 'all';
      state.filterSettings.maxPrice = 250000;
      state.filterSettings.airlines = ['Aura Elite Airways', 'SkyStream Express', 'Zenith Global', 'Oceanic Jetways'];
      state.filterSettings.timeSlot = 'all';
      state.filterSettings.sortBy = 'recommended';

      if (priceSlider) priceSlider.value = 250000;
      maxPriceLabel.textContent = formatMoney(250000);
      document.querySelector('input[name="stopsFilter"][value="all"]').checked = true;
      airlineCheckboxes.forEach(cb => cb.checked = true);
      timeSlotButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-slot') === 'all'));
      if (sortBySelect) sortBySelect.value = 'recommended';

      renderFlightCards();
      showToast('Filters reset to default.', 'info');
    });
  }

  function getFilteredAndSortedFlights() {
    let list = [...state.currentFlights];

    // Stops filter
    if (state.filterSettings.stops === 'direct' || state.searchParams.directOnly) {
      list = list.filter(f => f.isDirect);
    } else if (state.filterSettings.stops === '1stop') {
      list = list.filter(f => !f.isDirect);
    }

    // Price filter
    list = list.filter(f => f.basePriceINR <= state.filterSettings.maxPrice);

    // Airline filter
    list = list.filter(f => state.filterSettings.airlines.includes(f.airline.name));

    // Time slot filter
    if (state.filterSettings.timeSlot === 'morning') {
      list = list.filter(f => f.departs24 >= 6 && f.departs24 < 12);
    } else if (state.filterSettings.timeSlot === 'afternoon') {
      list = list.filter(f => f.departs24 >= 12 && f.departs24 < 18);
    } else if (state.filterSettings.timeSlot === 'evening') {
      list = list.filter(f => f.departs24 >= 18 || f.departs24 < 6);
    }

    // Sorting
    if (state.filterSettings.sortBy === 'cheapest') {
      list.sort((a, b) => a.basePriceINR - b.basePriceINR);
    } else if (state.filterSettings.sortBy === 'fastest') {
      list.sort((a, b) => a.durationMinutes - b.durationMinutes);
    } else if (state.filterSettings.sortBy === 'earliest') {
      list.sort((a, b) => a.departs24 - b.departs24);
    } else {
      // Recommended: Flagship first, then rating
      list.sort((a, b) => (b.airline.flagship ? 1 : 0) - (a.airline.flagship ? 1 : 0));
    }

    return list;
  }

  function renderFlightCards() {
    const flights = getFilteredAndSortedFlights();
    const countEl = document.getElementById('resultsCount');
    if (countEl) {
      countEl.textContent = `Showing ${flights.length} of ${state.currentFlights.length} available flights`;
    }

    if (flights.length === 0) {
      flightCardsContainer.innerHTML = `
        <div class="empty-trips-state">
          <i class="fa-solid fa-plane-slash"></i>
          <h3>No Flights Match Your Filters</h3>
          <p>Try adjusting your price slider, stops, or departure time window.</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('resetFiltersBtn').click()">Reset Filters</button>
        </div>
      `;
      return;
    }

    const originData = airports[state.searchParams.origin] || { code: state.searchParams.origin, terminal: 'T1' };
    const destData = airports[state.searchParams.destination] || { code: state.searchParams.destination, terminal: 'T2' };
    const totalTravelers = state.searchParams.adults + state.searchParams.children;

    flightCardsContainer.innerHTML = flights.map(flight => {
      const flightTotal = flight.basePriceINR * totalTravelers;
      const flagshipClass = flight.airline.flagship ? 'aura-flagship' : '';

      return `
        <article class="flight-card ${flagshipClass}">
          <div class="flight-card-inner">
            <!-- Airline Info -->
            <div class="flight-airline-info">
              <div class="airline-badge-logo ${flight.airline.logoClass}">
                <i class="fa-solid fa-plane"></i>
              </div>
              <div class="airline-meta">
                <h4>${flight.airline.name}</h4>
                <div class="flight-num-model">${flight.flightNumber} • ${flight.aircraft}</div>
              </div>
            </div>

            <!-- Route Visualization -->
            <div class="flight-itinerary-visual">
              <div class="flight-endpoint departure">
                <div class="flight-time">${flight.departTime}</div>
                <div class="flight-airport-code">${originData.code}</div>
                <div class="flight-terminal">Term. ${originData.terminal}</div>
              </div>

              <div class="flight-route-line-wrap">
                <div class="flight-duration">${flight.durationFormatted}</div>
                <div class="route-flight-track">
                  <i class="fa-solid fa-plane route-plane-icon"></i>
                </div>
                <div class="flight-stops-badge ${flight.isDirect ? '' : 'has-stop'}">${flight.stopsText}</div>
              </div>

              <div class="flight-endpoint arrival">
                <div class="flight-time">${flight.arriveTime}</div>
                <div class="flight-airport-code">${destData.code}</div>
                <div class="flight-terminal">Term. ${destData.terminal}</div>
              </div>
            </div>

            <!-- Price & CTA -->
            <div class="flight-pricing-cta">
              <div class="flight-price-total">${formatMoney(flightTotal)}</div>
              <div class="flight-price-note">Total for ${totalTravelers} traveler${totalTravelers > 1 ? 's' : ''}</div>
              <button class="btn btn-primary btn-select-flight" data-flight-id="${flight.id}">
                Select Seats & Book <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- Included Perks Bar -->
          <div class="flight-perks-row">
            ${flight.amenities.map(a => `<span class="perk-item"><i class="fa-solid fa-check"></i> ${a}</span>`).join('')}
          </div>
        </article>
      `;
    }).join('');

    // Attach click handlers to select flight
    document.querySelectorAll('.btn-select-flight').forEach(btn => {
      btn.addEventListener('click', () => {
        const flightId = btn.getAttribute('data-flight-id');
        const flight = state.currentFlights.find(f => f.id === flightId);
        if (flight) {
          openBookingModal(flight);
        }
      });
    });
  }

  // Quick Book buttons in trending destinations
  document.querySelectorAll('.quick-book-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const origin = btn.getAttribute('data-origin');
      const dest = btn.getAttribute('data-dest');
      if (originSelect && destSelect) {
        originSelect.value = origin;
        destSelect.value = dest;
        executeFlightSearch();
      }
    });
  });

  // =========================================================================
  // Booking Wizard Modal & Seat Selection
  // =========================================================================
  const bookingModal = document.getElementById('bookingModal');
  const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
  const modalFlightSnippet = document.getElementById('modalFlightSnippet');
  const cabinSeatGrid = document.getElementById('cabinSeatGrid');
  const selectedSeatBadge = document.getElementById('selectedSeatBadge');
  const goToStep2Btn = document.getElementById('goToStep2Btn');
  const goToStep3Btn = document.getElementById('goToStep3Btn');
  const goToStep4Btn = document.getElementById('goToStep4Btn');
  const backToStep1Btn = document.getElementById('backToStep1Btn');
  const backToStep2Btn = document.getElementById('backToStep2Btn');
  const backToStep3Btn = document.getElementById('backToStep3Btn');

  function openBookingModal(flight) {
    state.selectedFlight = flight;
    state.selectedSeat = null;
    state.activeStep = 1;
    updateWizardStepUI(1);

    // Populate snippet
    const originData = airports[state.searchParams.origin];
    const destData = airports[state.searchParams.destination];
    modalFlightSnippet.innerHTML = `
      <div class="snippet-route">
        <strong>${flight.airline.name} ${flight.flightNumber}</strong> • ${originData.city} (${originData.code}) <i class="fa-solid fa-arrow-right"></i> ${destData.city} (${destData.code})
      </div>
      <div class="snippet-time">
        <span>${flight.departTime} - ${flight.arriveTime}</span> (${flight.durationFormatted})
      </div>
    `;

    renderCabinSeatMap();
    selectedSeatBadge.textContent = 'None (Please click a seat)';
    goToStep2Btn.disabled = true;

    bookingModal.classList.add('active');
  }

  function updateWizardStepUI(stepNumber) {
    state.activeStep = stepNumber;

    // Update steps nav
    document.querySelectorAll('.step-item').forEach(item => {
      const itemStep = parseInt(item.getAttribute('data-step'));
      item.classList.toggle('active', itemStep === stepNumber);
      item.classList.toggle('completed', itemStep < stepNumber);
    });

    // Toggle wizard panels
    document.querySelectorAll('.wizard-step-content').forEach(content => {
      content.classList.remove('active');
    });
    const activeContent = document.getElementById(`wizardStep${stepNumber}`);
    if (activeContent) activeContent.classList.add('active');

    if (stepNumber === 4) {
      updateOrderSummary();
    }
  }

  closeBookingModalBtn?.addEventListener('click', () => {
    bookingModal.classList.remove('active');
  });

  // Render Seat Grid
  function renderCabinSeatMap() {
    cabinSeatGrid.innerHTML = '';
    const rowsCount = 14;
    const occupiedSeats = new Set(['1A', '2B', '3F', '4C', '7A', '7B', '9D', '10F', '12B', '14E']);

    for (let r = 1; r <= rowsCount; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';

      const rowNum = document.createElement('div');
      rowNum.className = 'seat-row-number';
      rowNum.textContent = r;
      rowEl.appendChild(rowNum);

      // Seats A, B, C
      ['A', 'B', 'C'].forEach(letter => {
        const seatId = `${r}${letter}`;
        const seatBtn = createSeatElement(seatId, r, occupiedSeats);
        rowEl.appendChild(seatBtn);
      });

      // Aisle space
      const aisle = document.createElement('div');
      aisle.className = 'aisle-space';
      rowEl.appendChild(aisle);

      // Seats D, E, F
      ['D', 'E', 'F'].forEach(letter => {
        const seatId = `${r}${letter}`;
        const seatBtn = createSeatElement(seatId, r, occupiedSeats);
        rowEl.appendChild(seatBtn);
      });

      cabinSeatGrid.appendChild(rowEl);
    }
  }

  function createSeatElement(seatId, row, occupiedSet) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seat-item';
    btn.textContent = seatId;
    btn.dataset.seatId = seatId;

    const isExtraLegroom = (row === 1 || row === 7);
    if (isExtraLegroom) {
      btn.classList.add('extra-legroom');
      btn.title = `${seatId} - Extra Legroom (+₹1,500)`;
    }

    if (occupiedSet.has(seatId)) {
      btn.classList.add('occupied');
      btn.disabled = true;
      btn.title = `${seatId} - Already Booked`;
    } else {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seat-item.selected').forEach(s => s.classList.remove('selected'));
        btn.classList.add('selected');
        
        const extraFee = isExtraLegroom ? 1500 : 0;
        state.selectedSeat = {
          id: seatId,
          extraLegroom: isExtraLegroom,
          fee: extraFee
        };

        selectedSeatBadge.textContent = `${seatId} ${isExtraLegroom ? '(Extra Legroom +₹1,500)' : '(Standard - Included)'}`;
        goToStep2Btn.disabled = false;
      });
    }

    return btn;
  }

  goToStep2Btn?.addEventListener('click', () => updateWizardStepUI(2));
  backToStep1Btn?.addEventListener('click', () => updateWizardStepUI(1));
  backToStep2Btn?.addEventListener('click', () => updateWizardStepUI(2));
  backToStep3Btn?.addEventListener('click', () => updateWizardStepUI(3));

  // Step 2 Form
  const passengerForm = document.getElementById('passengerForm');
  passengerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    state.passengerDetails = {
      title: document.getElementById('passTitle').value,
      firstName: document.getElementById('passFirstName').value.trim(),
      lastName: document.getElementById('passLastName').value.trim(),
      email: document.getElementById('passEmail').value.trim(),
      phone: document.getElementById('passPhone').value.trim(),
      idNumber: document.getElementById('passIdNumber').value.trim(),
      meal: document.getElementById('passMeal').value,
      frequentFlyer: document.getElementById('frequentFlyer').value.trim()
    };
    updateWizardStepUI(3);
  });

  // Step 3 Addons
  goToStep4Btn?.addEventListener('click', () => {
    state.selectedAddons = {
      baggage: document.getElementById('addonBaggage').checked,
      lounge: document.getElementById('addonLounge').checked,
      insurance: document.getElementById('addonInsurance').checked,
      carbon: document.getElementById('addonCarbon').checked
    };
    updateWizardStepUI(4);
  });

  // Payment Tabs
  document.querySelectorAll('.pay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const method = tab.getAttribute('data-method');

      document.getElementById('cardFields').style.display = method === 'card' ? 'block' : 'none';
      document.getElementById('upiFields').style.display = method === 'upi' ? 'block' : 'none';
      document.getElementById('netbankingFields').style.display = method === 'netbanking' ? 'block' : 'none';
    });
  });

  function updateOrderSummary() {
    if (!state.selectedFlight) return;

    const totalPax = state.searchParams.adults + state.searchParams.children;
    const baseAirfare = state.selectedFlight.basePriceINR * totalPax;
    const taxes = Math.round(baseAirfare * 0.10);
    const seatFee = state.selectedSeat ? state.selectedSeat.fee : 0;

    let addonsFee = 0;
    if (state.selectedAddons.baggage) addonsFee += 2900;
    if (state.selectedAddons.lounge) addonsFee += 3750;
    if (state.selectedAddons.insurance) addonsFee += 2100;
    if (state.selectedAddons.carbon) addonsFee += 400;

    const grandTotal = baseAirfare + taxes + seatFee + addonsFee;

    document.getElementById('summaryPassengerCount').textContent = totalPax;
    document.getElementById('summaryBasePrice').textContent = formatMoney(baseAirfare);
    document.getElementById('summaryTaxesPrice').textContent = formatMoney(taxes);
    document.getElementById('summarySeatName').textContent = state.selectedSeat ? state.selectedSeat.id : 'None';
    document.getElementById('summarySeatPrice').textContent = seatFee > 0 ? `+${formatMoney(seatFee)}` : 'Included';
    document.getElementById('summaryAddonsPrice').textContent = `+${formatMoney(addonsFee)}`;
    document.getElementById('summaryGrandTotal').textContent = formatMoney(grandTotal);

    state.lastCalculatedTotal = grandTotal;
  }

  // =========================================================================
  // Payment Confirmation & Boarding Pass Generation
  // =========================================================================
  const paymentForm = document.getElementById('paymentForm');
  const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
  const boardingPassModal = document.getElementById('boardingPassModal');
  const closePassModalBtn = document.getElementById('closePassModalBtn');

  paymentForm?.addEventListener('submit', (e) => {
    e.preventDefault();

    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing VIP Transaction...';

    setTimeout(() => {
      confirmPaymentBtn.disabled = false;
      confirmPaymentBtn.innerHTML = '<i class="fa-solid fa-check"></i> Pay & Issue Boarding Pass';

      // Generate PNR
      const pnr = `AUR-${Math.floor(10000 + Math.random() * 90000)}`;
      const bookingRecord = {
        pnr: pnr,
        bookingDate: new Date().toISOString(),
        flight: state.selectedFlight,
        passenger: state.passengerDetails,
        seat: state.selectedSeat ? state.selectedSeat.id : '12A',
        origin: state.searchParams.origin,
        dest: state.searchParams.destination,
        departDate: state.searchParams.departDate,
        totalPaid: state.lastCalculatedTotal,
        currency: state.currentCurrency,
        gate: `${Math.floor(1 + Math.random() * 20)}${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}`,
        boardingTime: '45 mins prior to departure',
        cabinClass: state.searchParams.cabinClass
      };

      // Save to localStorage
      state.bookings.unshift(bookingRecord);
      localStorage.setItem('aura_flight_bookings', JSON.stringify(state.bookings));
      updateBookingsBadge();

      // Close booking modal and open boarding pass
      bookingModal.classList.remove('active');
      renderBoardingPass(bookingRecord);
      boardingPassModal.classList.add('active');

      showToast(`Booking Successful! PNR: ${pnr}`, 'success');
    }, 1200);
  });

  function renderBoardingPass(booking) {
    const originData = airports[booking.origin] || { city: booking.origin, code: booking.origin };
    const destData = airports[booking.dest] || { city: booking.dest, code: booking.dest };

    document.getElementById('modalPnrDisplay').textContent = booking.pnr;
    document.getElementById('stubPnr').textContent = booking.pnr;
    document.getElementById('passCabinBadge').textContent = (booking.cabinClass || 'ECONOMY').toUpperCase() + ' CLASS';

    document.getElementById('passOriginCity').textContent = originData.city.toUpperCase();
    document.getElementById('passOriginCode').textContent = originData.code;
    document.getElementById('passDepartTime').textContent = booking.flight.departTime;

    document.getElementById('passDestCity').textContent = destData.city.toUpperCase();
    document.getElementById('passDestCode').textContent = destData.code;
    document.getElementById('passArriveTime').textContent = booking.flight.arriveTime;

    document.getElementById('passDuration').textContent = booking.flight.durationFormatted;
    document.getElementById('passStopsText').textContent = booking.flight.stopsText;

    const fullName = `${booking.passenger.title || 'Mr.'} ${booking.passenger.firstName || 'Alexander'} ${booking.passenger.lastName || 'Vance'}`.toUpperCase();
    document.getElementById('passPassengerName').textContent = fullName;
    document.getElementById('passFlightNumber').textContent = booking.flight.flightNumber;
    document.getElementById('passGateNumber').textContent = booking.gate;
    document.getElementById('passBoardingTime').textContent = booking.flight.departTime;
    document.getElementById('passSeatNumber').textContent = booking.seat;

    document.getElementById('stubPassenger').textContent = `${(booking.passenger.firstName || 'A')[0]}. ${booking.passenger.lastName || 'VANCE'}`.toUpperCase();
    document.getElementById('stubFlight').textContent = booking.flight.flightNumber;
    document.getElementById('stubSeat').textContent = booking.seat;
    document.getElementById('stubDate').textContent = new Date(booking.departDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

    // Draw QR code on Canvas
    drawDynamicQrCode(booking.pnr);
  }

  function drawDynamicQrCode(pnr) {
    const canvas = document.getElementById('ticketQrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render deterministic patterned QR barcode look
    ctx.fillStyle = '#070b14';
    const size = canvas.width;
    const cellSize = 5;
    const count = Math.floor(size / cellSize);

    // Corner Finder Patterns
    drawFinderPattern(ctx, 5, 5, 25);
    drawFinderPattern(ctx, size - 30, 5, 25);
    drawFinderPattern(ctx, 5, size - 30, 25);

    // Seeded inner matrix
    let seed = 0;
    for (let i = 0; i < pnr.length; i++) seed += pnr.charCodeAt(i);

    for (let x = 0; x < count; x++) {
      for (let y = 0; y < count; y++) {
        // Skip corner finder zones
        if ((x < 7 && y < 7) || (x > count - 8 && y < 7) || (x < 7 && y > count - 8)) continue;
        
        const bit = Math.sin(seed * (x * 13 + y * 7)) > 0;
        if (bit) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }
  }

  function drawFinderPattern(ctx, x, y, size) {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(x + 8, y + 8, size - 16, size - 16);
  }

  closePassModalBtn?.addEventListener('click', () => {
    boardingPassModal.classList.remove('active');
  });

  document.getElementById('finishBookingBtn')?.addEventListener('click', () => {
    boardingPassModal.classList.remove('active');
    openTripsModal();
  });

  document.getElementById('printTicketBtn')?.addEventListener('click', () => {
    window.print();
  });

  document.getElementById('downloadReceiptBtn')?.addEventListener('click', () => {
    const activeBooking = state.bookings[0];
    if (!activeBooking) return;

    const receiptContent = `
======================================================
         AURA WINGS — LUXURY E-TICKET RECEIPT
======================================================
PNR Reference    : ${activeBooking.pnr}
Booking Status   : CONFIRMED / TICKET ISSUED
Booking Date     : ${new Date(activeBooking.bookingDate).toLocaleString()}

FLIGHT DETAILS
------------------------------------------------------
Flight Number    : ${activeBooking.flight.flightNumber}
Aircraft         : ${activeBooking.flight.aircraft}
Route            : ${activeBooking.origin} -> ${activeBooking.dest}
Departure Date   : ${activeBooking.departDate}
Departure Time   : ${activeBooking.flight.departTime}
Arrival Time     : ${activeBooking.flight.arriveTime}
Gate             : ${activeBooking.gate}
Cabin Class      : ${activeBooking.cabinClass.toUpperCase()}
Assigned Seat    : ${activeBooking.seat}

PASSENGER DETAILS
------------------------------------------------------
Name             : ${activeBooking.passenger.title} ${activeBooking.passenger.firstName} ${activeBooking.passenger.lastName}
Email            : ${activeBooking.passenger.email}
Phone            : ${activeBooking.passenger.phone}
ID / Passport    : ${activeBooking.passenger.idNumber}
Meal Selected    : ${activeBooking.passenger.meal}

FARE BREAKDOWN
------------------------------------------------------
Total Paid       : ${formatMoney(activeBooking.totalPaid)}
Payment Status   : 256-Bit SSL Verified & Settled

Thank you for flying Aura Wings Global Elite Aviation.
======================================================
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AuraWings_Ticket_${activeBooking.pnr}.txt`;
    link.click();
    showToast('Itinerary downloaded successfully.', 'success');
  });

  // =========================================================================
  // "My Trips" Management
  // =========================================================================
  const myTripsModal = document.getElementById('myTripsModal');
  const myBookingsBtn = document.getElementById('myBookingsBtn');
  const closeTripsModalBtn = document.getElementById('closeTripsModalBtn');
  const tripsListContainer = document.getElementById('tripsListContainer');
  const bookingsBadge = document.getElementById('bookingsCountBadge');

  function updateBookingsBadge() {
    if (bookingsBadge) {
      bookingsBadge.textContent = state.bookings.length;
    }
  }
  updateBookingsBadge();

  myBookingsBtn?.addEventListener('click', () => openTripsModal());
  closeTripsModalBtn?.addEventListener('click', () => myTripsModal.classList.remove('active'));

  function openTripsModal() {
    renderTripsList();
    myTripsModal.classList.add('active');
  }

  function renderTripsList() {
    if (state.bookings.length === 0) {
      tripsListContainer.innerHTML = `
        <div class="empty-trips-state">
          <i class="fa-solid fa-plane-departure"></i>
          <h3>No Upcoming Trips Found</h3>
          <p>Book your first non-stop flight to Paris, London, Dubai, or Tokyo today.</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('myTripsModal').classList.remove('active'); document.getElementById('searchSection').scrollIntoView({behavior: 'smooth'})">Find Flights</button>
        </div>
      `;
      return;
    }

    tripsListContainer.innerHTML = state.bookings.map((booking, index) => {
      const orig = airports[booking.origin] || { city: booking.origin, code: booking.origin };
      const dst = airports[booking.dest] || { city: booking.dest, code: booking.dest };

      return `
        <div class="trip-item-card">
          <div class="trip-summary-left">
            <h4>
              <span>${orig.city} (${orig.code})</span>
              <i class="fa-solid fa-arrow-right"></i>
              <span>${dst.city} (${dst.code})</span>
            </h4>
            <p>
              <strong>PNR: ${booking.pnr}</strong> • ${booking.flight.flightNumber} • Seat ${booking.seat} • Dep: ${booking.departDate} (${booking.flight.departTime})
            </p>
          </div>
          <div class="trip-actions">
            <button class="btn btn-primary btn-sm view-pass-btn" data-index="${index}">
              <i class="fa-solid fa-ticket"></i> View Pass
            </button>
            <button class="btn btn-outline btn-sm cancel-trip-btn" data-index="${index}" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.4);">
              <i class="fa-solid fa-xmark"></i> Cancel
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach View Pass listeners
    document.querySelectorAll('.view-pass-btn').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.getAttribute('data-index'));
        const booking = state.bookings[idx];
        if (booking) {
          myTripsModal.classList.remove('active');
          renderBoardingPass(booking);
          boardingPassModal.classList.add('active');
        }
      });
    });

    // Attach Cancel Listeners
    document.querySelectorAll('.cancel-trip-btn').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.getAttribute('data-index'));
        const booking = state.bookings[idx];
        if (confirm(`Are you sure you want to cancel booking ${booking.pnr}? 100% refund of ${formatMoney(booking.totalPaid)} will be processed instantly.`)) {
          state.bookings.splice(idx, 1);
          localStorage.setItem('aura_flight_bookings', JSON.stringify(state.bookings));
          updateBookingsBadge();
          renderTripsList();
          showToast(`Booking ${booking.pnr} has been cancelled and refunded.`, 'info');
        }
      });
    });
  }

  // =========================================================================
  // Live Flight Status Radar Tracker
  // =========================================================================
  const trackFlightBtn = document.getElementById('trackFlightBtn');
  const statusFlightInput = document.getElementById('statusFlightInput');

  trackFlightBtn?.addEventListener('click', () => {
    const flightQuery = (statusFlightInput.value || 'AU-804').toUpperCase().trim();
    trackFlightBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tracking...';

    setTimeout(() => {
      trackFlightBtn.innerHTML = '<i class="fa-solid fa-radar"></i> Check Status';
      document.getElementById('statusFlightCode').textContent = `${flightQuery} • Aura Express`;
      showToast(`Radar locked on flight ${flightQuery} — Telemetry active`, 'success');
    }, 600);
  });

  // =========================================================================
  // Toast Notification System
  // =========================================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'circle-info';
    if (type === 'success') icon = 'circle-check';
    if (type === 'warning') icon = 'triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid fa-${icon}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // Initial currency conversion on load
  updateCurrencyAcrossPage();
});
