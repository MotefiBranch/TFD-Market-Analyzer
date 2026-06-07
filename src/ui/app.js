/**
 * TFD Market Analyzer — UI Controller
 * Manages search, stat builder, chart rendering, and analysis display.
 */

// ── State ──
let selectedMod = null;
let targetStats = [];
let currentTab = '30';
let currentAnalysis = null;
let currentListings = [];
let priceChart = null;
let searchDebounce = null;

// ── DOM Refs ──
const $ = (id) => document.getElementById(id);
const modSearch = $('mod-search');
const searchDropdown = $('search-dropdown');
const selectedModDisplay = $('selected-mod-display');
const selectedModName = $('selected-mod-name');
const clearModBtn = $('clear-mod');
const statRows = $('stat-rows');
const addStatBtn = $('add-stat-btn');
const analyzeBtn = $('analyze-btn');
const scrapeBtn = $('scrape-btn');
const saveTrackedBtn = $('save-tracked-btn');
const trackedList = $('tracked-list');
const emptyState = $('empty-state');
const analysisResults = $('analysis-results');
const tabNav = $('tab-nav');
const listingsGrid = $('listings-grid');
const listingsCount = $('listings-count');
const scrapeOverlay = $('scrape-overlay');
const scrapeStatusText = $('scrape-status-text');
const platformSelect = $('platform-select');

// ── Constants ──
const CHARACTER_GOD_ROLLS = {
  "Bunny": ["Electric Skill Power Boost Ratio", "Singular Skill Power Boost Ratio"],
  "Ultimate Bunny": ["Electric Skill Power Boost Ratio", "Singular Skill Power Boost Ratio"],
  "Gley": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Ultimate Gley": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Valby": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Ultimate Valby": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Ajax": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Ajax": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Viessa": ["Chill Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Viessa": ["Chill Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Lepic": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Lepic": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Freyna": ["Toxic Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Freyna": ["Toxic Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Yujin": ["Non-Attribute Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Ultimate Yujin": ["Non-Attribute Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Enzo": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Luna": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Luna": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Sharen": ["Electric Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Ultimate Sharen": ["Electric Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Blair": ["Fire Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Ultimate Blair": ["Fire Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Jayber": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Kyle": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Esiemo": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Ultimate Esiemo": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Hailey": ["Chill Skill Power Boost Ratio", "Singular Skill Power Boost Ratio"],
  "Dia": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Harris": ["Toxic Skill Power Boost Ratio", "Singular Skill Power Boost Ratio"],
  "Ines": ["Electric Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Keelan": ["Toxic Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Nell": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Serena": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"]
};

// ── Initialization ──
let appSettings = { platform: 'PC', favorites: [], trackedListings: [], autoTrack: false, trackInterval: 10 };

document.addEventListener('DOMContentLoaded', async () => {
  initWindowControls();
  initSearch();
  initStatBuilder();
  initCharacterOptimizer();
  initTabs();
  initActions();
  
  appSettings = await window.tfdApi.getSettings() || appSettings;
  if (!appSettings.favorites) appSettings.favorites = [];
  if (!appSettings.trackedListings) appSettings.trackedListings = [];
  if (appSettings.autoTrack === undefined) appSettings.autoTrack = false;
  if (appSettings.trackInterval === undefined) appSettings.trackInterval = 10;
  if (appSettings.platform) platformSelect.value = appSettings.platform;
  
  const autoTrackToggle = $('auto-track-toggle');
  const trackIntervalSelect = $('track-interval-select');
  
  if (autoTrackToggle) {
    autoTrackToggle.checked = appSettings.autoTrack;
    autoTrackToggle.addEventListener('change', async () => {
      if (autoTrackToggle.checked) {
        const confirmed = window.confirm("⚠️ WARNING: ZERO-INPUT AUTOMATION ⚠️\n\nEnabling Background Auto-Tracking turns this tool into an automated bot. This explicitly violates Nexon's Terms of Service. If abused or detected, it could result in an account ban.\n\nDo you accept the risk and wish to enable this feature?");
        if (!confirmed) {
          autoTrackToggle.checked = false;
          return;
        }
      }
      
      appSettings.autoTrack = autoTrackToggle.checked;
      await window.tfdApi.updateSettings({ autoTrack: appSettings.autoTrack });
      if (appSettings.autoTrack) startBackgroundTracker();
      else stopBackgroundTracker();
    });
  }
  
  if (trackIntervalSelect) {
    trackIntervalSelect.value = appSettings.trackInterval;
    trackIntervalSelect.addEventListener('change', async () => {
      appSettings.trackInterval = parseInt(trackIntervalSelect.value, 10);
      await window.tfdApi.updateSettings({ trackInterval: appSettings.trackInterval });
      if (appSettings.autoTrack) {
        stopBackgroundTracker();
        startBackgroundTracker();
      }
    });
  }
  
  if (appSettings.autoTrack) startBackgroundTracker();
  
  platformSelect.addEventListener('change', async () => {
    appSettings.platform = platformSelect.value;
    await window.tfdApi.updateSettings({ platform: appSettings.platform });
  });

  const listingsSortSelect = $('listings-sort-select');
  if (listingsSortSelect) {
    listingsSortSelect.addEventListener('change', () => {
      if (currentListings && currentListings.length > 0) {
        renderListings(currentListings);
      }
    });
  }

  renderFavorites();
  renderWatchlist();
  await updateDbStats();

  const dbHistorySelect = $('db-history-select');
  if (dbHistorySelect) {
    try {
      const allMods = await window.tfdApi.getAllMods();
      if (allMods && allMods.length > 0) {
        allMods.sort().forEach(mod => {
          const opt = document.createElement('option');
          opt.value = mod;
          opt.textContent = mod;
          dbHistorySelect.appendChild(opt);
        });
      }
      dbHistorySelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          modSearch.value = val;
          searchDropdown.classList.remove('show');
          selectedMod = val;
          selectedModName.textContent = val;
          selectedModDisplay.classList.remove('hidden');
          runAnalysis();
          dbHistorySelect.value = '';
        }
      });
    } catch(err) {
      console.error('Failed to load DB history:', err);
    }
  }

  initCustomDescendants();
  initScrapeStatusListener();
});

// ── Favorites & Watchlist ──
function renderFavorites() {
  if (!trackedList) return;
  trackedList.innerHTML = '';
  
  if (!appSettings.favorites || appSettings.favorites.length === 0) {
    trackedList.innerHTML = '<li style="font-size:12px;color:var(--text-muted);padding:8px 0;">No favorites yet</li>';
    return;
  }
  
  appSettings.favorites.forEach(mod => {
    const li = document.createElement('li');
    li.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--bg-elevated); border:1px solid var(--glass-border); border-radius:6px; margin-bottom:6px; cursor:pointer;";
    li.innerHTML = `
      <span style="font-size:13px; color:var(--text-primary); font-weight:500;">${escapeHtml(mod)}</span>
      <button class="delete-btn" style="background:none; border:none; color:var(--text-danger); cursor:pointer; font-size:14px;">×</button>
    `;
    
    li.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        selectMod(mod);
        runAnalysis();
      }
    });
    
    li.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      appSettings.favorites = appSettings.favorites.filter(m => m !== mod);
      await window.tfdApi.updateSettings({ favorites: appSettings.favorites });
      renderFavorites();
      showToast('Removed from favorites');
    });
    
    trackedList.appendChild(li);
  });
}

function renderWatchlist() {
  const watchlistEl = $('watchlist-list');
  if (!watchlistEl) return;
  watchlistEl.innerHTML = '';
  
  if (!appSettings.trackedListings || appSettings.trackedListings.length === 0) {
    watchlistEl.innerHTML = '<li style="font-size:12px;color:var(--text-muted);padding:8px 0;">No tracked listings</li>';
    return;
  }
  
  appSettings.trackedListings.forEach(item => {
    const li = document.createElement('li');
    const isSold = item.status === 'Sold/Removed';
    const isPriceChanged = item.status === 'Price Changed';
    
    let statusStyle = "color:var(--text-secondary);";
    if (isSold) statusStyle = "color:var(--text-danger);";
    if (isPriceChanged) statusStyle = "color:var(--accent-amber);";
    
    li.style.cssText = `display:flex; flex-direction:column; padding:8px; background:var(--bg-elevated); border:1px solid var(--glass-border); border-radius:6px; margin-bottom:6px; cursor:pointer; opacity: ${isSold ? '0.6' : '1'};`;
    
    li.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${escapeHtml(item.modName)}</span>
        <button class="delete-wl-btn" style="background:none; border:none; color:var(--text-danger); cursor:pointer; font-size:14px; padding:0;">×</button>
      </div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
        Sold by: <strong style="color:var(--text-bright);">${escapeHtml(item.sellerName)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
        <span style="font-size:12px; font-weight:bold; color:var(--accent-blue);">${formatPrice(item.price)} Cal</span>
        <span style="font-size:10px; font-weight:bold; ${statusStyle}">${item.status}</span>
      </div>
    `;
    
    li.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        selectMod(item.modName);
        runAnalysis();
      }
    });
    
    li.querySelector('.delete-wl-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      appSettings.trackedListings = appSettings.trackedListings.filter(m => m.id !== item.id);
      await window.tfdApi.updateSettings({ trackedListings: appSettings.trackedListings });
      renderWatchlist();
      showToast('Removed from watchlist');
    });
    
    watchlistEl.appendChild(li);
  });
}

window.toggleTrackListing = async function(btnElement, listingJson) {
  const listing = JSON.parse(decodeURIComponent(listingJson));
  const id = `${listing.sellerName}_${listing.statSignature}`;
  
  const existingIdx = appSettings.trackedListings.findIndex(l => l.id === id);
  
  if (existingIdx >= 0) {
    appSettings.trackedListings.splice(existingIdx, 1);
    btnElement.innerHTML = '☆';
    btnElement.title = 'Track Listing';
    btnElement.style.color = 'var(--text-muted)';
    showToast('Removed from Watchlist');
  } else {
    appSettings.trackedListings.push({
      id: id,
      modName: selectedMod,
      sellerName: listing.sellerName,
      price: listing.price,
      statSignature: listing.statSignature,
      socketType: listing.socketType,
      requiredRank: listing.requiredRank,
      addedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'Active'
    });
    btnElement.innerHTML = '⭐';
    btnElement.title = 'Untrack Listing';
    btnElement.style.color = 'var(--accent-amber)';
    showToast('⭐ Saved to Watchlist!');
  }
  
  await window.tfdApi.updateSettings({ trackedListings: appSettings.trackedListings });
  renderWatchlist();
};

// ── Window Controls ──
function initWindowControls() {
  $('btn-minimize')?.addEventListener('click', () => window.tfdApi?.minimizeWindow());
  $('btn-maximize')?.addEventListener('click', () => window.tfdApi?.maximizeWindow());
  $('btn-close')?.addEventListener('click', () => window.tfdApi?.closeWindow());
}

// ── Search ──
function initSearch() {
  modSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(modSearch.value), 200);
  });

  modSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && modSearch.value.trim().length > 0) {
      e.preventDefault();
      selectMod(modSearch.value.trim());
    }
  });

  modSearch.addEventListener('focus', () => {
    if (modSearch.value.length >= 1) performSearch(modSearch.value);
  });

  document.addEventListener('click', (e) => {
    if (!modSearch.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.remove('visible');
    }
  });

  clearModBtn.addEventListener('click', () => {
    selectedMod = null;
    selectedModDisplay.classList.add('hidden');
    modSearch.value = '';
    modSearch.focus();
  });
}

async function performSearch(query) {
  if (!query || query.length < 1) {
    searchDropdown.classList.remove('visible');
    return;
  }

  try {
    const results = await window.tfdApi.searchMods(query);
    renderSearchResults(results);
  } catch (err) {
    console.error('Search failed:', err);
  }
}

function renderSearchResults(results) {
  if (!results || results.length === 0) {
    searchDropdown.innerHTML = '<div class="autocomplete-item" style="color:var(--text-muted);">No mods found</div>';
    searchDropdown.classList.add('visible');
    return;
  }

  searchDropdown.innerHTML = results.map(name =>
    `<div class="autocomplete-item" data-mod="${escapeHtml(name)}">${escapeHtml(name)}</div>`
  ).join('');

  searchDropdown.classList.add('visible');

  searchDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => selectMod(item.dataset.mod));
  });
}

async function selectMod(modName) {
  selectedMod = modName;
  selectedModName.textContent = modName;
  selectedModDisplay.classList.remove('hidden');
  modSearch.value = '';
  searchDropdown.classList.remove('visible');

  // Load available stats for this mod
  try {
    const stats = await window.tfdApi.getStatsForMod(modName);
    updateStatOptions(stats);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ── Stat Builder ──
function initStatBuilder() {
  addStatBtn.addEventListener('click', addStatRow);
}

function addStatRow() {
  const row = document.createElement('div');
  row.className = 'stat-row';
  row.innerHTML = `
    <button class="stat-sign positive" title="Toggle positive/negative">+</button>
    <input type="text" placeholder="Stat name..." class="stat-name-input" style="flex:1;">
    <input type="text" placeholder="Current" class="stat-value-input" style="width:55px;text-align:center;">
    <input type="text" placeholder="Max" class="stat-value-max-input" style="width:55px;text-align:center;">
    <button class="remove-stat" title="Remove">✕</button>
  `;

  // Toggle positive/negative
  const signBtn = row.querySelector('.stat-sign');
  signBtn.addEventListener('click', () => {
    if (signBtn.classList.contains('positive')) {
      signBtn.classList.remove('positive');
      signBtn.classList.add('negative');
      signBtn.textContent = '−';
    } else {
      signBtn.classList.remove('negative');
      signBtn.classList.add('positive');
      signBtn.textContent = '+';
    }
  });

  // Remove row
  row.querySelector('.remove-stat').addEventListener('click', () => {
    row.remove();
  });

  statRows.appendChild(row);
}

function updateStatOptions(stats) {
  // This could populate a datalist for autocomplete on stat name inputs
  // For now it's available as reference data
}

function getTargetStats() {
  const rows = statRows.querySelectorAll('.stat-row');
  const stats = [];
  rows.forEach(row => {
    const name = row.querySelector('.stat-name-input')?.value?.trim();
    const value = row.querySelector('.stat-value-input')?.value?.trim();
    const maxValue = row.querySelector('.stat-value-max-input')?.value?.trim();
    const isPositive = row.querySelector('.stat-sign')?.classList.contains('positive');
    if (name) {
      stats.push({ name, value: value || '', maxValue: maxValue || '', positive: isPositive });
    }
  });
  return stats;
}

// ── Tabs ──
function initTabs() {
  tabNav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabNav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      if (currentAnalysis) renderChart(currentAnalysis.chartData);
    });
  });
}

// ── Character Optimizer ──
function initCharacterOptimizer() {
  const charInput = $('target-character-input');
  const promptBox = $('character-optimizer-prompt');
  const statsDiv = $('character-suggested-stats');
  const btnApply = $('btn-apply-suggested');
  const btnFilter = $('btn-just-filter');

  charInput.addEventListener('change', () => {
    const val = charInput.value.trim();
    if (CHARACTER_GOD_ROLLS[val]) {
      promptBox.classList.remove('hidden');
      statsDiv.innerHTML = CHARACTER_GOD_ROLLS[val].join('<br>+ ');
      statsDiv.innerHTML = '+ ' + statsDiv.innerHTML;
    } else {
      promptBox.classList.add('hidden');
    }
  });

  btnApply.addEventListener('click', () => {
    const val = charInput.value.trim();
    if (!CHARACTER_GOD_ROLLS[val]) return;
    
    // Clear existing stats
    statRows.innerHTML = '';
    
    // Add new stats
    CHARACTER_GOD_ROLLS[val].forEach(stat => {
      addStatRow();
      const rows = statRows.querySelectorAll('.stat-row');
      const lastRow = rows[rows.length - 1];
      lastRow.querySelector('.stat-name-input').value = stat;
    });
    
    runAnalysis();
  });

  btnFilter.addEventListener('click', () => {
    runAnalysis();
  });
}

// ── Actions ──
function initActions() {
  analyzeBtn.addEventListener('click', runAnalysis);
  scrapeBtn.addEventListener('click', openMarketBrowser);
  $('empty-scrape-btn')?.addEventListener('click', openMarketBrowser);
  $('scroll-btn')?.addEventListener('click', autoScrollBrowser);
  $('extract-btn')?.addEventListener('click', extractData);
  
  $('save-tracked-btn')?.addEventListener('click', async () => {
    if (!selectedMod) {
      showToast('Please select a mod first!');
      return;
    }
    if (!appSettings.favorites.includes(selectedMod)) {
      appSettings.favorites.push(selectedMod);
      await window.tfdApi.updateSettings({ favorites: appSettings.favorites });
      renderFavorites();
      showToast(`⭐ Saved ${selectedMod} to Favorites!`);
    } else {
      showToast('Already in favorites!');
    }
  });

  $('refresh-favorites-btn')?.addEventListener('click', () => startInteractiveRefresh('favorites'));
  $('refresh-watchlist-btn')?.addEventListener('click', () => startInteractiveRefresh('watchlist'));
  $('refresh-all-btn')?.addEventListener('click', () => startInteractiveRefresh('all'));
  
  // Developer Settings Modal (Konami Code)
  $('close-dev-settings-btn')?.addEventListener('click', () => {
    $('dev-settings-modal').style.display = 'none';
  });

  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiIndex = 0;
  
  document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        konamiIndex = 0;
        showToast('🎮 DEVELOPER MODE UNLOCKED!');
        const modal = $('dev-settings-modal');
        if (modal) {
          modal.style.display = 'flex';
          modal.classList.remove('hidden');
        }
      }
    } else {
      konamiIndex = 0;
    }
  });
}

async function runAnalysis() {
  if (!selectedMod && modSearch.value.trim().length > 0) {
    await selectMod(modSearch.value.trim());
  }

  const targetCharacter = $('target-character-input')?.value?.trim() || null;

  if (!selectedMod && !targetCharacter) {
    showToast('Please select a module or a Character first');
    return;
  }

  const stats = getTargetStats();
  const platform = platformSelect.value;
  const targetSocket = $('target-socket-input')?.value?.trim() || null;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '⏳ Analyzing...';

  try {
    const result = await window.tfdApi.analyze(selectedMod, stats, platform, 30, targetSocket, targetCharacter);
    currentAnalysis = result;
    currentListings = result.listings || [];

    emptyState.classList.add('hidden');
    analysisResults.classList.remove('hidden');

    renderSummary(result.summary);
    renderChart(result.chartData);
    renderListings(currentListings);
    
    // Cross-reference live data with our watchlist to find sold/price-changed items
    await checkWatchlistStatus(currentListings, selectedMod);
  } catch (err) {
    console.error('Analysis failed:', err);
    showToast('Analysis failed: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '📊 Analyze Prices';
  }
}

async function checkWatchlistStatus(liveListings, modName) {
  if (!appSettings.trackedListings || appSettings.trackedListings.length === 0) return;
  
  let updated = false;
  const now = new Date().toISOString();
  
  // We only check tracked items that match the mod we just scraped/analyzed
  for (let item of appSettings.trackedListings) {
    if (item.modName !== modName) continue;
    
    // Find matching listing in the live data
    const liveMatch = liveListings.find(l => {
      const liveStatSig = (l.stats || []).filter(s => s.statName && s.statName !== 'null').map(s => s.statName).join('|');
      const liveSeller = l.seller_name || l.sellerName;
      return liveSeller === item.sellerName && liveStatSig === item.statSignature;
    });
    
    if (liveMatch) {
      item.lastSeenAt = now;
      if (item.price !== liveMatch.price) {
        item.status = 'Price Changed';
        item.price = liveMatch.price;
        updated = true;
        window.tfdApi.showNotification('Watchlist Alert', `${item.modName} (by ${item.sellerName}) changed price to ${formatPrice(liveMatch.price)} Cal`);
      } else if (item.status !== 'Active') {
        item.status = 'Active'; // It came back or was marked incorrectly
        updated = true;
      }
    } else {
      // It's not in the live data anymore!
      if (item.status !== 'Sold/Removed') {
        item.status = 'Sold/Removed';
        updated = true;
        window.tfdApi.showNotification('Watchlist Alert', `${item.modName} (by ${item.sellerName}) was Sold or Removed!`);
      }
    }
  }
  
  if (updated) {
    await window.tfdApi.updateSettings({ trackedListings: appSettings.trackedListings });
    renderWatchlist();
    showToast('Watchlist statuses updated!');
  }
}

async function openMarketBrowser() {
  setStatus('scraping', 'Opening Market Browser...');
  try {
    const res = await window.tfdApi.scrape(); // This now just opens the window
    if (res.status === 'opened') {
      setStatus('idle', 'Browser open. Navigate to the mod, then click Auto-Scroll.');
      showToast('🌐 Market browser opened. Navigate to your module, then click Auto-Scroll!');
    }
  } catch (err) {
    showToast('Failed to open browser');
    setStatus('error', 'Error opening browser');
  }
}

async function autoScrollBrowser() {
  setStatus('scraping', 'Auto-Scrolling...');
  showToast('🔄 Auto-scrolling to load all hidden listings... Please wait!');
  try {
    const res = await window.tfdApi.scroll();
    if (res.success) {
      setStatus('idle', 'Auto-Scroll complete. Ready to extract.');
      showToast('✅ Auto-Scroll complete! Auto-extracting now...');
    } else {
      showToast('⚠️ Could not scroll. Is the browser open?');
      setStatus('error', 'Scroll failed');
    }
  } catch (err) {
    showToast('Failed to auto-scroll');
    setStatus('error', 'Error auto-scrolling');
  }
}

async function extractData() {
  if (!selectedMod && modSearch.value.trim().length > 0) {
    await selectMod(modSearch.value.trim());
  }

  if (!selectedMod) {
    showToast('Please select the module you are viewing in the browser first');
    return;
  }

  setStatus('scraping', 'Extracting data from browser...');
  showToast('⚡ Extracting loaded listings...');
  try {
    // This executes parser.js in the open window
    const result = await window.tfdApi.scrape(selectedMod, platformSelect.value);
    
    if (result.success) {
      if (result.count > 0) {
        setStatus('idle', `Extraction complete — ${result.count} listings captured`);
        showToast(`✅ Successfully extracted ${result.count} listings!`);
        await updateDbStats();
        await runAnalysis();
      } else {
        setStatus('error', 'No listings found');
        showToast('⚠️ No listings found. Make sure you scrolled down on the correct mod page.');
      }
    } else {
      setStatus('error', 'Extraction failed');
      showToast('❌ Extraction failed: ' + result.error);
    }
  } catch (err) {
    setStatus('error', 'Extraction error');
    showToast('❌ ' + err.message);
  }
}

async function openMarketBrowser() {
  try {
    const res = await window.tfdApi.scrape('init', platformSelect.value);
    if (res && res.status === 'opened') {
      showToast('🌐 Opening Market Browser...');
    }
  } catch (err) {
    console.error('Failed to open browser:', err);
  }
}

// ── Interactive Refresh Loop ──
let abortRefreshLoop = false;

function showRefreshModal(modName) {
  return new Promise((resolve) => {
    const modal = $('refresh-modal');
    $('refresh-mod-name').textContent = modName;
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    const handleYes = () => { cleanup(); resolve('yes'); };
    const handleNo = () => { cleanup(); resolve('no'); };
    const handleAbort = () => { cleanup(); resolve('abort'); };

    $('refresh-btn-yes').addEventListener('click', handleYes);
    $('refresh-btn-no').addEventListener('click', handleNo);
    $('refresh-btn-abort').addEventListener('click', handleAbort);

    function cleanup() {
      modal.style.display = 'none';
      modal.classList.add('hidden');
      $('refresh-btn-yes').removeEventListener('click', handleYes);
      $('refresh-btn-no').removeEventListener('click', handleNo);
      $('refresh-btn-abort').removeEventListener('click', handleAbort);
    }
  });
}

async function startInteractiveRefresh(listType = 'favorites') {
  let listToRefresh = [];

  if (listType === 'favorites') {
    listToRefresh = appSettings.favorites || [];
    if (listToRefresh.length === 0) {
      showToast('Your Favorites list is empty.');
      return;
    }
  } else if (listType === 'watchlist') {
    const activeTracked = (appSettings.trackedListings || []).filter(l => l.status !== 'Sold/Removed');
    listToRefresh = [...new Set(activeTracked.map(l => l.modName))];
    if (listToRefresh.length === 0) {
      showToast('No active tracked items in your Watchlist.');
      return;
    }
  } else if (listType === 'all') {
    // Show disclaimer for "All"
    const confirmAll = confirm("WARNING: This will loop through every single item in the database, requiring manual confirmation for each one. This could take a long time.\n\nDo you want to proceed?");
    if (!confirmAll) return;
    
    listToRefresh = await window.tfdApi.getAllMods() || [];
    if (listToRefresh.length === 0) {
      showToast('Database is empty. Scrape some mods first!');
      return;
    }
  }

  abortRefreshLoop = false;
  
  for (const mod of listToRefresh) {
    if (abortRefreshLoop) break;
    
    // Auto-select the mod in the UI so the user sees what's happening
    await selectMod(mod);

    // Prompt user
    const choice = await showRefreshModal(mod);

    if (choice === 'abort') {
      showToast('Loop aborted.');
      abortRefreshLoop = true;
      break;
    }
    
    if (choice === 'yes') {
      // Ensure browser is open before attempting to navigate
      await openMarketBrowser();
      
      // Give the browser a second to render/load if it was just opened
      await new Promise(r => setTimeout(r, 2000));

      // Step 1: Tell backend to navigate/search
      setStatus('scraping', `Searching for ${mod}...`);
      const navRes = await window.tfdApi.scrapeNavigate(mod);
      if (!navRes.success) {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(mod).catch(e => console.error('Clipboard failed', e));
        showToast(`Could not inject search. '${mod}' copied to clipboard! Please paste it into the search bar manually.`);
        // Pause to let the user manually search if injection failed.
        continue;
      }
      
      // Step 2: Auto-Scroll
      await autoScrollBrowser();
      await new Promise(r => setTimeout(r, 1000)); // Wait a second for it to settle

      // Step 3: Extract
      await extractData();
      await new Promise(r => setTimeout(r, 1000)); // Small delay before next prompt
      
      // User Preference: Close the browser after every single item is extracted
      await window.tfdApi.closeBrowser();
    }
  }
  
  if (!abortRefreshLoop) {
    showToast('✅ Finished interactive refresh loop!');
  }
  
  // QoL: Automatically close the market browser when the loop finishes or is aborted
  await window.tfdApi.closeBrowser();
}

// ── Rendering ──

function renderSummary(summary) {
  $('card-median').textContent = formatPrice(summary.current);
  $('card-7d-avg').textContent = formatPrice(summary.avg7d);
  $('card-30d-avg').textContent = formatPrice(summary.avg30d);

  renderChange($('card-median-change'), summary.change1d, 'vs yesterday');
  renderChange($('card-7d-change'), summary.change7d, '7d change');
  renderChange($('card-30d-change'), summary.change30d, '30d change');

  const trendIcons = { rising: '📈', falling: '📉', stable: '➡️' };
  $('card-trend').textContent = trendIcons[summary.trend] || '➡️';

  if (summary.isEstimate) {
    $('card-listings').textContent = `0 Live (Estimated)`;
    $('card-listings').className = 'summary-card__change down';
    $('card-median').parentElement.querySelector('.summary-card__label').textContent = 'ESTIMATED PRICE';
    
    // Additional tooltip/hint in the listings count header
    $('listings-count').textContent = '0 live results (Showing ML Estimate)';
  } else {
    $('card-listings').textContent = `${summary.listingCount} listings`;
    $('card-listings').className = 'summary-card__change stable';
    $('card-median').parentElement.querySelector('.summary-card__label').textContent = 'MEDIAN PRICE';
  }
}

function renderChange(el, value, label) {
  if (value > 0) {
    el.className = 'summary-card__change up';
    el.textContent = `▲ +${value.toFixed(1)}% ${label}`;
  } else if (value < 0) {
    el.className = 'summary-card__change down';
    el.textContent = `▼ ${value.toFixed(1)}% ${label}`;
  } else {
    el.className = 'summary-card__change stable';
    el.textContent = `— ${label}`;
  }
}

function renderChart(chartData) {
  let data;
  if (currentTab === '30') data = chartData.thirtyDay;
  else if (currentTab === '7') data = chartData.sevenDay;
  else data = chartData.today;

  if (!data || data.labels.length === 0) {
    $('chart-container').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:280px;color:var(--text-muted);font-size:14px;">No price data available for this period</div>';
    return;
  }

  // Ensure canvas exists
  if (!$('price-chart')) {
    $('chart-container').innerHTML = '<canvas id="price-chart"></canvas>';
  }

  const ctx = $('price-chart').getContext('2d');

  if (priceChart) priceChart.destroy();

  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Median Price',
          data: data.medianLine,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.08)',
          borderWidth: 2.5,
          fill: false,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#00d4ff',
          pointBorderColor: '#0a0e17',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
        },
        {
          label: 'Max Price',
          data: data.maxBand,
          borderColor: 'rgba(139, 92, 246, 0.4)',
          backgroundColor: 'rgba(139, 92, 246, 0.06)',
          borderWidth: 1,
          borderDash: [4, 4],
          fill: false,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'Min Price',
          data: data.minBand,
          borderColor: 'rgba(16, 185, 129, 0.4)',
          backgroundColor: 'rgba(16, 185, 129, 0.06)',
          borderWidth: 1,
          borderDash: [4, 4],
          fill: '-1',
          tension: 0.35,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#8b95a8', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 21, 36, 0.95)',
          titleColor: '#e8ecf4',
          bodyColor: '#8b95a8',
          borderColor: 'rgba(99, 130, 255, 0.2)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: 'Inter', weight: '700', size: 13 },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatPrice(context.parsed.y)} Cal`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#5a6478', font: { family: 'Inter', size: 11 }, maxRotation: 0 },
          grid: { color: 'rgba(99, 130, 255, 0.06)' }
        },
        y: {
          ticks: {
            color: '#5a6478',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (val) => formatPrice(val)
          },
          grid: { color: 'rgba(99, 130, 255, 0.06)' }
        }
      },
      animation: { duration: 600, easing: 'easeInOutCubic' }
    }
  });
}

function renderListings(listings) {
  if (!listings || listings.length === 0) {
    if (currentAnalysis && currentAnalysis.summary && currentAnalysis.summary.isEstimate) {
      listingsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);"><h4 style="margin-bottom:8px;color:var(--text-bright);">0 Exact Matches</h4><p>We generated an estimated True Market Value based on historical stat premiums across the game economy.</p></div>';
    } else {
      listingsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">No matching listings found</div>';
    }
    listingsCount.textContent = '0 results';
    return;
  }

  listingsCount.textContent = `${listings.length} results`;

  const sortSelect = $('listings-sort-select');
  const sortValue = sortSelect ? sortSelect.value : 'best_match';
  
  let sortedListings = [...listings];
  if (sortValue === 'price_asc') {
    sortedListings.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sortValue === 'price_desc') {
    sortedListings.sort((a, b) => (b.price || 0) - (a.price || 0));
  } else {
    sortedListings.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return (b.matchScore || 0) - (a.matchScore || 0);
      return (a.price || 0) - (b.price || 0);
    });
  }

  listingsGrid.innerHTML = sortedListings.slice(0, 1000).map(l => {
    const matchClass = l.matchType === 'exact' ? 'exact' : l.matchType === 'partial' ? 'partial' : 'subset';
    const matchLabel = l.matchScore !== undefined ? `${l.matchScore}%` : '';
    const statusClass = (l.sellerStatus || '').toLowerCase().includes('online') ? 'online' : 'offline';
    const stats = (l.stats || []).filter(s => s.statName && s.statName !== 'null');
    
    // Check if this listing is tracked
    const statSignature = stats.map(s => s.statName).join('|');
    const sellerName = l.seller_name || l.sellerName || 'Unknown';
    const id = `${sellerName}_${statSignature}`;
    const isTracked = appSettings.trackedListings && appSettings.trackedListings.some(t => t.id === id);
    const starColor = isTracked ? 'var(--accent-amber)' : 'var(--text-muted)';
    const starIcon = isTracked ? '⭐' : '☆';
    
    const listingData = {
      sellerName: sellerName,
      price: l.price,
      statSignature: statSignature,
      socketType: l.socket_type || l.socketType || '',
      requiredRank: l.required_rank || l.requiredRank || ''
    };
    const encodedListing = encodeURIComponent(JSON.stringify(listingData));

    return `
      <div class="listing-card" style="position:relative;">
        <button onclick="toggleTrackListing(this, '${encodedListing}')" style="position:absolute; top:12px; right:12px; background:none; border:none; cursor:pointer; font-size:16px; color:${starColor}; z-index:10;" title="${isTracked ? 'Untrack Listing' : 'Track Listing'}">${starIcon}</button>
        ${matchLabel ? `<div class="listing-card__match ${matchClass}" style="margin-right:24px;">${matchLabel} match</div>` : ''}
        <div class="listing-card__price">${formatPrice(l.price)}<span>Caliber</span></div>
        <div class="listing-card__seller">
          <span class="${statusClass}">●</span>
          <span style="display:inline-block;">
            ${escapeHtml(l.seller_name || l.sellerName || 'Unknown')}
            ${l.seller_rank || l.sellerRank ? ` · MR ${escapeHtml(l.seller_rank || l.sellerRank)}` : ''}
            ${l.reroll_count !== undefined && l.reroll_count > 0 ? ` · Rerolls <strong style="color:var(--text-primary);">${l.reroll_count}</strong>` : ''}
            ${l.required_rank ? ` · Req MR ${escapeHtml(l.required_rank)}` : ''}
            ${l.socket_type ? `<img src="assets/sockets/${escapeHtml(l.socket_type.toLowerCase())}.png" alt="${escapeHtml(l.socket_type)}" title="${escapeHtml(l.socket_type)}" style="width:14px; height:14px; vertical-align:middle; margin-left:4px; opacity: 0.8;">` : ''}
          </span>
        </div>
        <div class="listing-card__stats" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
          ${stats.map(s => {
            let cls = s.isPositive ? 'positive' : s.isNegative ? 'negative' : 'neutral';
            
            if (cls === 'neutral') {
              const rawValue = String(s.statValue || '');
              const statName = (s.statName || '').toLowerCase();
              
              const isNegativeMath = rawValue.startsWith('-');
              const isInverseStat = statName.includes('cooldown') || statName.includes('cost');

              if (isNegativeMath && !isInverseStat) {
                cls = 'negative';
              } else if (!isNegativeMath && isInverseStat && rawValue.match(/[0-9]/)) {
                cls = 'negative';
              } else {
                cls = 'positive';
              }
            }

            const cleanValue = String(s.statValue || '').replace(/\[\+\]|\[\-\]/g, '').trim();
            return `<span class="stat-chip ${cls}">${escapeHtml(s.statName || '')} ${escapeHtml(cleanValue)}</span>`;
          }).join('')}
        </div>
        ${l.available_characters && l.available_characters.length > 0 ? `
        <div class="listing-card__characters" style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
          ${l.available_characters.map(char => `<img src="${char.src}" alt="${escapeHtml(char.name)}" title="${escapeHtml(char.name)}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--glass-border);">`).join('')}
        </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function initScrapeStatusListener() {
  // Not used in public version
}

// ── Background Tracker ──
let trackerIntervalId = null;

function startBackgroundTracker() {
  if (trackerIntervalId) clearInterval(trackerIntervalId);
  const ms = (appSettings.trackInterval || 10) * 60 * 1000;
  trackerIntervalId = setInterval(executeBackgroundTracking, ms);
  console.log(`Background tracking started. Interval: ${appSettings.trackInterval}m`);
}

function stopBackgroundTracker() {
  if (trackerIntervalId) {
    clearInterval(trackerIntervalId);
    trackerIntervalId = null;
  }
  console.log('Background tracking stopped.');
}

async function executeBackgroundTracking() {
  if (!appSettings.autoTrack) return;
  
  // Gather unique modules from both active Watchlist AND DB History
  let uniqueMods = [];
  try {
    const historyMods = await window.tfdApi.getAllMods();
    if (historyMods) uniqueMods.push(...historyMods);
  } catch (err) {
    console.error('Failed to get DB history for tracking:', err);
  }

  if (appSettings.trackedListings && appSettings.trackedListings.length > 0) {
    const activeTracked = appSettings.trackedListings.filter(l => l.status !== 'Sold/Removed').map(l => l.modName);
    uniqueMods.push(...activeTracked);
  }
  
  // Deduplicate the list
  uniqueMods = [...new Set(uniqueMods)];
  
  if (uniqueMods.length === 0) return;
  
  console.log(`Starting background tracking for ${uniqueMods.length} modules...`);
  
  for (const mod of uniqueMods) {
    try {
      // 1. Open hidden browser
      await window.tfdApi.scrape('init', appSettings.platform, true);
      await new Promise(r => setTimeout(r, 2000));
      
      // 2. Navigate and search invisibly
      const navRes = await window.tfdApi.scrapeNavigate(mod);
      if (!navRes.success) {
        await window.tfdApi.closeBrowser();
        continue;
      }
      
      // 3. Wait for scroll invisibly
      await window.tfdApi.scroll();
      
      // 4. Extract data invisibly
      const extractRes = await window.tfdApi.scrape(mod, appSettings.platform, true);
      
      if (extractRes.success && extractRes.count > 0) {
        // Run analysis silently to check watchlist status triggers
        const result = await window.tfdApi.analyze(mod, [], appSettings.platform, 1);
        await checkWatchlistStatus(result.listings, mod);
      }
      
      // Clean up
      await window.tfdApi.closeBrowser();
      
    } catch (err) {
      console.error(`Background tracking failed for ${mod}:`, err);
      await window.tfdApi.closeBrowser();
    }
  }
  console.log('Background tracking cycle complete.');
}

// ── Utilities ──

function formatPrice(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString('en-US');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(state, text) {
  const dot = $('status-dot');
  const statusText = $('status-text');
  dot.className = `status-bar__dot ${state}`;
  statusText.textContent = text;
}

async function updateDbStats() {
  try {
    const stats = await window.tfdApi.getDbStats();
    $('db-stats').textContent = `${stats.totalListings} listings · ${stats.uniqueMods} mods · ${stats.totalDays} days`;
  } catch (err) {
    $('db-stats').textContent = '—';
  }
}

function showToast(message) {
  // Simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:48px;right:24px;
    padding:10px 18px;border-radius:10px;
    background:rgba(15,21,36,0.95);border:1px solid rgba(99,130,255,0.2);
    color:#e8ecf4;font-size:13px;font-family:Inter,sans-serif;
    box-shadow:0 4px 16px rgba(0,0,0,0.4);
    z-index:9999;animation:fadeSlideIn 200ms ease-out;
    backdrop-filter:blur(8px);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Custom Descendants Management ──
function renderCustomDescendantHistory() {
  const historyList = $('custom-desc-history');
  if (!historyList) return;

  historyList.innerHTML = '';
  
  let savedCustomDesc = {};
  try {
    savedCustomDesc = JSON.parse(localStorage.getItem('custom_descendants')) || {};
  } catch(e) {}

  const names = Object.keys(savedCustomDesc);
  
  if (names.length === 0) {
    historyList.innerHTML = '<li style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">No custom descendants found</li>';
    return;
  }

  names.forEach(name => {
    const li = document.createElement('li');
    li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:6px;';
    
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'display:flex; flex-direction:column;';
    
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:2px;';
    nameSpan.textContent = name;
    
    const stats = savedCustomDesc[name];
    const statsSpan = document.createElement('span');
    statsSpan.style.cssText = 'font-size:10px; color:var(--text-muted);';
    statsSpan.textContent = stats.join(' · ');
    
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(statsSpan);
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑️';
    delBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:14px; opacity:0.6; padding:4px; transition:opacity 0.2s;';
    delBtn.onmouseover = () => delBtn.style.opacity = '1';
    delBtn.onmouseout = () => delBtn.style.opacity = '0.6';
    
    delBtn.onclick = () => {
      delete savedCustomDesc[name];
      localStorage.setItem('custom_descendants', JSON.stringify(savedCustomDesc));
      delete CHARACTER_GOD_ROLLS[name];
      
      const charSelect = $('target-character-select');
      if (charSelect) {
        for (let i = 0; i < charSelect.options.length; i++) {
          if (charSelect.options[i].value === name) {
            charSelect.remove(i);
            break;
          }
        }
      }
      renderCustomDescendantHistory();
    };
    
    li.appendChild(infoDiv);
    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
}

function initCustomDescendants() {
  const openModalBtn = $('btn-open-custom-desc-modal');
  const modal = $('custom-desc-modal');
  const closeModalBtn = $('close-custom-desc-modal');
  const addBtn = $('btn-add-custom-desc');

  if (!openModalBtn || !modal) return;

  let savedCustomDesc = {};
  try {
    savedCustomDesc = JSON.parse(localStorage.getItem('custom_descendants')) || {};
    for (const [name, stats] of Object.entries(savedCustomDesc)) {
      CHARACTER_GOD_ROLLS[name] = stats;
      
      const charSelect = $('target-character-select');
      if (charSelect) {
        const existing = Array.from(charSelect.options).find(opt => opt.value === name);
        if (!existing) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          charSelect.appendChild(opt);
        }
      }
    }
  } catch (err) {}

  openModalBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    renderCustomDescendantHistory();
  });

  closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  });

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nameInput = $('custom-desc-name').value.trim();
      const attrInput = $('custom-desc-attribute').value;
      const archInput = $('custom-desc-archetype').value;
      const archInput2 = $('custom-desc-archetype-2').value;

      if (!nameInput || !attrInput || !archInput) {
        showToast('⚠️ Please enter a name, attribute, and primary archetype.');
        return;
      }

      const generatedStats = [
        `${attrInput} Skill Power Boost Ratio`,
        `${archInput} Skill Power Boost Ratio`
      ];

      if (archInput2 && archInput2 !== archInput) {
        generatedStats.push(`${archInput2} Skill Power Boost Ratio`);
      }

      CHARACTER_GOD_ROLLS[nameInput] = generatedStats;

      try {
        const saved = JSON.parse(localStorage.getItem('custom_descendants')) || {};
        saved[nameInput] = generatedStats;
        localStorage.setItem('custom_descendants', JSON.stringify(saved));
      } catch (err) {}

      const charSelect = $('target-character-select');
      if (charSelect) {
        let existing = Array.from(charSelect.options).find(opt => opt.value === nameInput);
        if (!existing) {
          const opt = document.createElement('option');
          opt.value = nameInput;
          opt.textContent = nameInput;
          charSelect.appendChild(opt);
          charSelect.value = nameInput;
        }
      }

      showToast(`✅ Custom descendant ${nameInput} added!`);
      
      $('custom-desc-name').value = '';
      $('custom-desc-attribute').value = '';
      $('custom-desc-archetype').value = '';
      $('custom-desc-archetype-2').value = '';
      
      renderCustomDescendantHistory();
    });
  }
}
