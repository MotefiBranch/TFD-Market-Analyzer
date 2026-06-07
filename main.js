/**
 * TFD Market Analyzer — Electron Main Process
 * Orchestrates scraper, database, analysis, and UI.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initDatabase } = require('./src/database/schema');
const { MarketDB } = require('./src/database/queries');
const { PricingCalculator } = require('./src/analysis/pricing');
const { StatMatcher } = require('./src/analysis/matcher');
const { TrendComputer } = require('./src/analysis/trends');
const { Estimator } = require('./src/analysis/estimator');
const fs = require('fs');

let mainWindow = null;
let marketWindow = null;
let tray = null;
let dbWrapper = null;
let marketDB = null;

// Default settings
let settings = {
  platform: 'PC',
  scrapeInterval: 1,
  autoScrape: true,
  theme: 'dark'
};

// ── App Initialization ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0a0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Dev tools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

async function initServices() {
  // Database
  const dbPath = path.join(app.getPath('userData'), 'data', 'market.sqlite');
  dbWrapper = await initDatabase(dbPath);
  marketDB = new MarketDB(dbWrapper);
}

// ── IPC Handlers ──

function registerIPC() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.hide());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.hide());
  
  ipcMain.handle('show-notification', async (_e, title, body) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icons', 'icon.png') }).show();
    }
  });

  // Scrape / Extract
  ipcMain.handle('scrape:close', async () => {
    if (marketWindow && !marketWindow.isDestroyed()) {
      marketWindow.close();
      marketWindow = null;
    }
    return { success: true };
  });

  ipcMain.handle('scrape:run', async (_e, modName, platform, hidden = false) => {
    try {
      if (!marketWindow || marketWindow.isDestroyed()) {
        marketWindow = new BrowserWindow({
          width: 1200, height: 800,
          show: !hidden,
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        
        // Block annoying analytics/images to load faster if we wanted, but let's keep it normal
        marketWindow.on('closed', () => marketWindow = null);
        try {
          await marketWindow.loadURL(`https://tfd.nexon.com/en/market`, {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          });
        } catch (e) {
          console.warn('loadURL warning (safe to ignore if page loads):', e.message);
        }
        
        return { success: true, count: 0, status: 'opened' };
      }

      // If the window is open, inject parser.js and extract data!
      const parserCode = fs.readFileSync(path.join(__dirname, 'src', 'scraper', 'parser.js'), 'utf8');
      
      // We need to execute the parseMarketPage function from the parser.js file
      // Since parser.js is written as a module, we just read it and append a call to it.
      const injectCode = `
        ${parserCode.replace('module.exports = { parseMarketPage };', '')}
        parseMarketPage();
      `;

      const modules = await marketWindow.webContents.executeJavaScript(injectCode);

      if (modules && modules.length > 0) {
        const scrapeId = uuidv4();
        const count = marketDB.insertListings(scrapeId, modules, platform || settings.platform);
        marketDB.computeDailyPrices();
        return { success: true, count, status: 'extracted' };
      }
      return { success: true, count: 0, status: 'extracted' };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scrape:navigate', async (_e, modName) => {
    try {
      if (!marketWindow || marketWindow.isDestroyed()) {
        return { success: false, error: 'Browser not open' };
      }
      
      // Step 0: Debug DOM state
      const debugCode = `
        new Promise(resolve => {
          const inputs = Array.from(document.querySelectorAll('input'));
          resolve({
            foundById: !!document.getElementById('search__input'),
            foundByClass: !!document.querySelector('.search__input'),
            totalInputs: inputs.length,
            placeholders: inputs.map(i => i.placeholder).filter(p => p),
            ids: inputs.map(i => i.id).filter(id => id),
            url: window.location.href,
            readyState: document.readyState
          });
        });
      `;
      const debugInfo = await marketWindow.webContents.executeJavaScript(debugCode);
      console.log("[DEBUG] Scrape Navigate DOM Info:", debugInfo);

      // Step 1: Focus and clear the input
      const focusCode = `
        new Promise(resolve => {
          const searchInput = document.getElementById('search__input') || 
                              document.querySelector('.search__input') || 
                              document.querySelector('input[type="text"]') ||
                              document.querySelector('input');
                              
          if (searchInput) {
            searchInput.focus();
            searchInput.value = ''; 
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            resolve(true);
          } else {
            resolve(false);
          }
        });
      `;
      
      const focused = await marketWindow.webContents.executeJavaScript(focusCode);
      if (!focused) {
        console.error("[DEBUG] Failed to focus any input!");
        return { success: false, error: 'Could not find search input on page' };
      }

      // Step 2: Use Electron to physically type the text
      marketWindow.webContents.insertText(modName);

      // Step 3: Trigger the search
      const submitCode = `
        new Promise(resolve => {
          const searchInput = document.getElementById('search__input') || 
                              document.querySelector('.search__input') || 
                              document.querySelector('input[type="text"]') ||
                              document.querySelector('input');
                              
          if (searchInput) {
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            const searchBtn = document.querySelector('.search__btn');
            if (searchBtn) {
              searchBtn.click();
            } else {
              searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
              searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
            }
            resolve(true);
          } else {
            resolve(false);
          }
        });
      `;
      
      await marketWindow.webContents.executeJavaScript(submitCode);
      return { success: true };
    } catch (err) {
      console.error('Navigate error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scrape:scroll', async () => {
    try {
      if (!marketWindow || marketWindow.isDestroyed()) {
        return { success: false, error: 'Browser not open' };
      }

      const scrollCode = `
        (async function autoScroll() {
          return new Promise((resolve) => {
            let lastHeight = 0;
            let unchangedCount = 0;
            
            // Check every 1 second
            const timer = setInterval(() => {
              window.scrollTo(0, document.body.scrollHeight);
              let currentHeight = document.body.scrollHeight;
              
              if (currentHeight === lastHeight) {
                unchangedCount++;
                // Wait for 5 full seconds of NO changes before giving up
                if (unchangedCount >= 5) {
                  clearInterval(timer);
                  resolve(true);
                }
              } else {
                lastHeight = currentHeight;
                unchangedCount = 0; // Reset counter if it successfully loaded more!
              }
            }, 1000);
          });
        })();
      `;

      await marketWindow.webContents.executeJavaScript(scrollCode);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('scrape:status', () => ({ isRunning: false }));
  ipcMain.handle('scrape:abort', () => ({ success: true }));

  // Analysis
  ipcMain.handle('analysis:search', (_e, query) => {
    const allMods = marketDB.getModNames();
    if (!query) return allMods.slice(0, 50);
    const q = query.toLowerCase();
    return allMods.filter(m => m.toLowerCase().includes(q)).slice(0, 50);
  });

  ipcMain.handle('analysis:all-mods', () => {
    return marketDB.getModNames();
  });

  ipcMain.handle('analysis:stats', (_e, modName) => {
    return marketDB.getStatsForMod(modName);
  });

  ipcMain.handle('analysis:analyze', (_e, modName, targetStats, platform, days, targetSocket, targetCharacter) => {
    const p = platform || settings.platform;
    const d = days || 30;

    // Get listings with stats
    let listings = marketDB.getListingsWithStats(modName, p, d);

    if (targetSocket) {
      const ts = targetSocket.toLowerCase();
      listings = listings.filter(l => l.socket_type && l.socket_type.toLowerCase().includes(ts));
    }

    if (targetCharacter) {
      const tc = targetCharacter.toLowerCase();
      listings = listings.filter(l => {
        if (!l.available_characters || !Array.isArray(l.available_characters)) return false;
        return l.available_characters.some(char => char.name && char.name.toLowerCase().includes(tc));
      });
    }

    // Deduplicate listings (same seller, price, stats, and registration date)
    const uniqueListingsMap = new Map();
    for (const l of listings) {
      const seller = l.seller_name || l.sellerName || 'Unknown';
      const statsSignature = (l.stats || []).map(s => s.statName).sort().join('|');
      const regDate = l.reg_date || ''; // Include the "X minutes ago" string
      const uniqueKey = `${seller}_${l.price}_${statsSignature}_${regDate}`;
      if (!uniqueListingsMap.has(uniqueKey)) {
        uniqueListingsMap.set(uniqueKey, l);
      }
    }
    listings = Array.from(uniqueListingsMap.values());

    // Rank by stat match
    const ranked = StatMatcher.rankListings(targetStats || [], listings);

    // Get price history (only if a specific mod is selected)
    const history = modName ? marketDB.getDailyPriceHistory(modName, p, d) : [];

    // Build chart data
    const chartData = TrendComputer.buildChartData(history);

    // Compute summary
    let summary;
    if (!modName) {
      summary = { median: 0, change: 0, stability: 'N/A', averageVolume: 0 };
    } else if (history.length === 0 && ranked.length === 0 && targetStats && targetStats.length > 0) {
      summary = Estimator.estimatePrice(marketDB, modName, targetStats, p);
    } else {
      summary = PricingCalculator.computeSummary(history);
    }

    // Get today's data
    const todayPrices = modName ? marketDB.getTodayPrices(modName, p) : [];

    return {
      summary,
      chartData,
      listings: ranked.slice(0, 1000),
      todayPrices,
      totalListings: listings.length,
      matchStats: targetStats && targetStats.length > 0 ? {
        exactMatches: ranked.filter(r => r.matchType === 'exact').length,
        partialMatches: ranked.filter(r => r.matchType === 'partial').length,
        subsetMatches: ranked.filter(r => r.matchType === 'subset').length,
      } : null
    };
  });

  ipcMain.handle('analysis:history', (_e, modName, platform, days) => {
    const history = marketDB.getDailyPriceHistory(modName, platform || settings.platform, days || 30);
    return TrendComputer.buildChartData(history);
  });

  // Removed scheduler and tracked mod IPC handlers for public release

  // Settings
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }

  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:update', (_e, newSettings) => {
    settings = { ...settings, ...newSettings };
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    return { success: true };
  });

  ipcMain.handle('db:stats', () => marketDB.getDbStats());
}

function setupTray() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'icon.png');
  let trayIcon;
  if (require('fs').existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // 16x16 transparent fallback pixel
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR42mNkYPhfzzAKBgwNQGgww2jA0ACERgaMBgAAg2oD/zFj8qQAAAAASUVORK5CYII=');
  }
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open TFD Analyzer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('TFD Market Analyzer');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
}

// ── App Lifecycle ──

app.whenReady().then(async () => {
  await initServices();
  registerIPC();
  createWindow();
  setupTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  // Don't quit! Stay in system tray.
  if (process.platform === 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (marketWindow && !marketWindow.isDestroyed()) marketWindow.close();
});
