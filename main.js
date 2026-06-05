/**
 * TFD Market Analyzer — Electron Main Process
 * Orchestrates scraper, database, analysis, and UI.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initDatabase } = require('./src/database/schema');
const { MarketDB } = require('./src/database/queries');
const { PricingCalculator } = require('./src/analysis/pricing');
const { StatMatcher } = require('./src/analysis/matcher');
const { TrendComputer } = require('./src/analysis/trends');
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

  // Scrape / Extract
  ipcMain.handle('scrape:run', async (_e, modName, platform) => {
    try {
      if (!marketWindow || marketWindow.isDestroyed()) {
        marketWindow = new BrowserWindow({
          width: 1200, height: 800,
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
        
        (async function autoScrollAndParse() {
          return new Promise((resolve) => {
            let lastHeight = 0;
            let unchangedCount = 0;
            
            const timer = setInterval(() => {
              window.scrollTo(0, document.body.scrollHeight);
              let currentHeight = document.body.scrollHeight;
              
              if (currentHeight === lastHeight) {
                unchangedCount++;
                // Stop if height hasn't changed for ~1.5s
                if (unchangedCount >= 3) {
                  clearInterval(timer);
                  resolve(parseMarketPage());
                }
              } else {
                lastHeight = currentHeight;
                unchangedCount = 0;
              }
            }, 500);
          });
        })();
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

  ipcMain.handle('scrape:status', () => ({ isRunning: false }));
  ipcMain.handle('scrape:abort', () => ({ success: true }));

  // Analysis
  ipcMain.handle('analysis:search', (_e, query) => {
    const allMods = marketDB.getModNames();
    if (!query) return allMods.slice(0, 50);
    const q = query.toLowerCase();
    return allMods.filter(m => m.toLowerCase().includes(q)).slice(0, 50);
  });

  ipcMain.handle('analysis:stats', (_e, modName) => {
    return marketDB.getStatsForMod(modName);
  });

  ipcMain.handle('analysis:analyze', (_e, modName, targetStats, platform, days) => {
    const p = platform || settings.platform;
    const d = days || 30;

    // Get listings with stats
    const listings = marketDB.getListingsWithStats(modName, p, d);

    // Rank by stat match
    const ranked = StatMatcher.rankListings(targetStats || [], listings);

    // Get price history
    const history = marketDB.getDailyPriceHistory(modName, p, d);

    // Build chart data
    const chartData = TrendComputer.buildChartData(history);

    // Compute summary
    const summary = PricingCalculator.computeSummary(history);

    // Get today's data
    const todayPrices = marketDB.getTodayPrices(modName, p);

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
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:update', (_e, newSettings) => {
    settings = { ...settings, ...newSettings };
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
