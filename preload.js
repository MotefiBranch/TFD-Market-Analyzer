/**
 * Preload Script — Secure IPC bridge between main and renderer.
 * Exposes a controlled API surface via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tfdApi', {
  // ── Scraper ──
  scrape: (modName, platform) => ipcRenderer.invoke('scrape:run', modName, platform),
  scroll: () => ipcRenderer.invoke('scrape:scroll'),
  scrapeNavigate: (modName) => ipcRenderer.invoke('scrape:navigate', modName),
  getScrapeStatus: () => ipcRenderer.invoke('scrape:status'),
  abortScrape: () => ipcRenderer.invoke('scrape:abort'),

  // ── Analysis ──
  searchMods: (query) => ipcRenderer.invoke('analysis:search', query),
  getAllMods: () => ipcRenderer.invoke('analysis:all-mods'),
  analyze: (modName, stats, platform, days, targetSocket, targetCharacter) => ipcRenderer.invoke('analysis:analyze', modName, stats, platform, days, targetSocket, targetCharacter),
  getHistory: (modName, platform, days) => ipcRenderer.invoke('analysis:history', modName, platform, days),
  getStatsForMod: (modName) => ipcRenderer.invoke('analysis:stats', modName),

  // ── Tracked Mods ──
  saveTracked: (modName, stats, platform) => ipcRenderer.invoke('tracked:save', modName, stats, platform),
  getTracked: () => ipcRenderer.invoke('tracked:list'),
  deleteTracked: (id) => ipcRenderer.invoke('tracked:delete', id),

  // ── Scheduler ──
  startScheduler: (intervalHours) => ipcRenderer.invoke('scheduler:start', intervalHours),
  stopScheduler: () => ipcRenderer.invoke('scheduler:stop'),
  getSchedulerStatus: () => ipcRenderer.invoke('scheduler:status'),

  // ── Settings ──
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  getDbStats: () => ipcRenderer.invoke('db:stats'),

  // ── Events (main → renderer) ──
  onScrapeStatus: (cb) => {
    const listener = (_event, status, detail) => cb(status, detail);
    ipcRenderer.on('scrape:status-update', listener);
    return () => ipcRenderer.removeListener('scrape:status-update', listener);
  },
  onSchedulerStatus: (cb) => {
    const listener = (_event, status, detail) => cb(status, detail);
    ipcRenderer.on('scheduler:status-update', listener);
    return () => ipcRenderer.removeListener('scheduler:status-update', listener);
  },

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
