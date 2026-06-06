/**
 * TFD Market Analyzer — UI Controller
 * Manages search, stat builder, chart rendering, and analysis display.
 */

// ── State ──
let selectedMod = null;
let targetStats = [];
let currentTab = '30';
let currentAnalysis = null;
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
  "Enzo": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Luna": ["Non-Attribute Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Sharen": ["Electric Skill Power Boost Ratio", "Fusion Skill Power Boost Ratio"],
  "Blair": ["Fire Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Jayber": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Kyle": ["Non-Attribute Skill Power Boost Ratio", "Dimension Skill Power Boost Ratio"],
  "Esiemo": ["Fire Skill Power Boost Ratio", "Tech Skill Power Boost Ratio"],
  "Hailey": ["Chill Skill Power Boost Ratio", "Singular Skill Power Boost Ratio"]
};

// ── Initialization ──
let appSettings = { platform: 'PC', favorites: [] };

document.addEventListener('DOMContentLoaded', async () => {
  initWindowControls();
  initSearch();
  initStatBuilder();
  initCharacterOptimizer();
  initTabs();
  initActions();
  
  appSettings = await window.tfdApi.getSettings() || appSettings;
  if (!appSettings.favorites) appSettings.favorites = [];
  if (appSettings.platform) platformSelect.value = appSettings.platform;
  
  platformSelect.addEventListener('change', async () => {
    appSettings.platform = platformSelect.value;
    await window.tfdApi.updateSettings({ platform: appSettings.platform });
  });

  renderFavorites();
  await updateDbStats();
  initScrapeStatusListener();
});

// ── Favorites ──
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

  $('refresh-favorites-btn')?.addEventListener('click', startInteractiveRefresh);
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

    emptyState.classList.add('hidden');
    analysisResults.classList.remove('hidden');

    renderSummary(result.summary);
    renderChart(result.chartData);
    renderListings(result.listings);
  } catch (err) {
    console.error('Analysis failed:', err);
    showToast('Analysis failed: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '📊 Analyze Prices';
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
      showToast('✅ Auto-Scroll complete! Click Extract Data now.');
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

async function startInteractiveRefresh() {
  if (!appSettings.favorites || appSettings.favorites.length === 0) {
    showToast('Your Favorites list is empty.');
    return;
  }

  abortRefreshLoop = false;
  
  for (const mod of appSettings.favorites) {
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
      // Step 1: Tell backend to navigate/search
      setStatus('scraping', `Searching for ${mod}...`);
      const navRes = await window.tfdApi.scrapeNavigate(mod);
      if (!navRes.success) {
        showToast(`Could not navigate to ${mod}. Opening browser, please manually search and hit Auto-Scroll.`);
        await openMarketBrowser();
        // Pause to let the user manually search if injection failed.
        // We do NOT auto-extract if nav fails because we don't know when they're done.
        // They will have to click extract themselves, and the loop will pause.
        // Actually, let's just abort this iteration.
        continue;
      }
      
      // Step 2: Auto-Scroll
      await autoScrollBrowser();
      await new Promise(r => setTimeout(r, 1000)); // Wait a second for it to settle

      // Step 3: Extract
      await extractData();
      await new Promise(r => setTimeout(r, 1000)); // Small delay before next prompt
    }
  }
  
  if (!abortRefreshLoop) {
    showToast('✅ Finished interactive refresh loop!');
  }
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

  listingsGrid.innerHTML = listings.slice(0, 1000).map(l => {
    const matchClass = l.matchType === 'exact' ? 'exact' : l.matchType === 'partial' ? 'partial' : 'subset';
    const matchLabel = l.matchScore !== undefined ? `${l.matchScore}%` : '';
    const statusClass = (l.sellerStatus || '').toLowerCase().includes('online') ? 'online' : 'offline';
    const stats = (l.stats || []).filter(s => s.statName && s.statName !== 'null');

    return `
      <div class="listing-card">
        ${matchLabel ? `<div class="listing-card__match ${matchClass}">${matchLabel} match</div>` : ''}
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
        <div class="listing-card__stats">
          ${stats.map(s => {
            let cls = s.isPositive ? 'positive' : s.isNegative ? 'negative' : 'neutral';
            
            if (cls === 'neutral') {
              const rawValue = String(s.statValue || '');
              const statName = (s.statName || '').toLowerCase();
              
              // Only consider the actual value part, not dashes in the name
              const isNegativeMath = rawValue.startsWith('-');
              const isInverseStat = statName.includes('cooldown') || statName.includes('cost');

              if (isNegativeMath && !isInverseStat) {
                cls = 'negative'; // Decreased Power/Damage (Bad)
              } else if (!isNegativeMath && isInverseStat && rawValue.match(/[0-9]/)) {
                cls = 'negative'; // Increased Cooldown/Cost (Bad)
              } else {
                cls = 'positive'; // Normal buff (Good)
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
