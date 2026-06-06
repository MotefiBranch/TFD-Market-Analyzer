/**
 * Data Access Layer for TFD Market Analyzer (sql.js version).
 * sql.js uses a synchronous API similar to better-sqlite3 but with slight differences.
 */

const crypto = require('crypto');

class MarketDB {
  /**
   * @param {Object} dbWrapper - { db, save, close } from initDatabase
   */
  constructor(dbWrapper) {
    this.db = dbWrapper.db;
    this.save = dbWrapper.save;
  }

  _run(sql, params = []) {
    this.db.run(sql, params);
  }

  _get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  _all(sql, params = []) {
    const results = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // ── Listing Operations ──

  /**
   * Insert a batch of parsed listings from a scrape session.
   */
  insertListings(scrapeId, modules, platform = 'PC') {
    const now = new Date().toISOString();
    let insertCount = 0;

    this._run('BEGIN TRANSACTION');
    try {
      for (const mod of modules) {
        const price = this._parsePrice(mod.price);
        if (price <= 0) continue;

        this._run(`
          INSERT INTO listings (scrape_id, scraped_at, mod_name, category, socket_type,
            required_rank, price, platform, reroll_count, seller_name, seller_status, seller_rank, reg_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          scrapeId, now, mod.name || '', mod.category || '', mod.socketType || '',
          mod.requiredRank || '', price, mod.platform || platform,
          parseInt(mod.rerollCount) || 0, mod.sellerName || '', mod.sellerStatus || '',
          mod.sellerRank || '', mod.regDate || ''
        ]);

        // Get last inserted ID
        const lastId = this._get('SELECT last_insert_rowid() as id');
        const listingId = lastId ? lastId.id : null;

        if (listingId && mod.stats && mod.stats.length > 0) {
          for (const stat of mod.stats) {
            const statName = this._normalizeStatName(stat.raw || '');
            this._run(`
              INSERT INTO listing_stats (listing_id, stat_name, stat_value, is_positive, is_negative, raw_label)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [listingId, statName, stat.value || '', stat.positive ? 1 : 0, stat.negative ? 1 : 0, stat.raw || '']);
          }
        }
        insertCount++;
      }
      this._run('COMMIT');
    } catch (err) {
      this._run('ROLLBACK');
      throw err;
    }

    this.save();
    return insertCount;
  }

  _parsePrice(priceStr) {
    if (!priceStr) return 0;
    const cleaned = String(priceStr).replace(/[^0-9]/g, '');
    return parseInt(cleaned) || 0;
  }

  _normalizeStatName(rawLabel) {
    return rawLabel.replace(/^\(\+\)|^\(\-\)/, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  }

  // ── Daily Price Aggregation ──

  computeDailyPrices() {
    const d = new Date();
    const date = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // Get all listings for today
    const listings = this._all(`
      SELECT l.id, l.mod_name, l.platform, l.price
      FROM listings l
      WHERE DATE(l.scraped_at, 'localtime') = ?
    `, [date]);

    // Group by mod_name + platform
    const groups = {};
    for (const listing of listings) {
      // Get stats for this listing
      const stats = this._all('SELECT stat_name FROM listing_stats WHERE listing_id = ?', [listing.id]);
      const statSig = this._computeStatSignature(stats.map(s => s.stat_name).join('|'));
      const key = `${listing.mod_name}|${listing.platform}|${statSig}`;
      if (!groups[key]) {
        groups[key] = { modName: listing.mod_name, platform: listing.platform, statSignature: statSig, prices: [] };
      }
      groups[key].prices.push(listing.price);
    }

    this._run('BEGIN TRANSACTION');
    try {
      for (const [, group] of Object.entries(groups)) {
        const sorted = group.prices.sort((a, b) => a - b);
        const median = this._median(sorted);
        const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;

        this._run(`
          INSERT INTO daily_prices (date, mod_name, platform, stat_signature, median_price, avg_price, min_price, max_price, listing_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(date, mod_name, platform, stat_signature) DO UPDATE SET
            median_price = ?, avg_price = ?, min_price = ?, max_price = ?, listing_count = ?
        `, [
          date, group.modName, group.platform, group.statSignature,
          Math.round(median), Math.round(avg * 100) / 100, sorted[0], sorted[sorted.length - 1], sorted.length,
          Math.round(median), Math.round(avg * 100) / 100, sorted[0], sorted[sorted.length - 1], sorted.length
        ]);
      }
      this._run('COMMIT');
    } catch (err) {
      this._run('ROLLBACK');
      throw err;
    }

    this.save();
  }

  _computeStatSignature(statNamesStr) {
    if (!statNamesStr) return 'none';
    const names = statNamesStr.split('|').filter(Boolean).sort();
    return crypto.createHash('md5').update(names.join('|')).digest('hex').substring(0, 12);
  }

  _median(sorted) {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // ── Query Operations ──

  getModNames() {
    return this._all('SELECT DISTINCT mod_name FROM listings WHERE mod_name != "" ORDER BY mod_name')
      .map(r => r.mod_name);
  }

  getStatsForMod(modName) {
    return this._all(`
      SELECT DISTINCT ls.stat_name, ls.is_positive, ls.is_negative
      FROM listing_stats ls JOIN listings l ON l.id = ls.listing_id
      WHERE l.mod_name = ? AND ls.stat_name != ''
      ORDER BY ls.stat_name
    `, [modName]);
  }

  getListingsWithStats(modName, platform = null, days = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateLimitStr = dateLimit.toISOString();

    let query = 'SELECT * FROM listings WHERE mod_name = ? AND scraped_at >= ?';
    const params = [modName, dateLimitStr];

    if (platform && platform !== 'ALL') {
      if (platform === 'PC') query += " AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')";
      else if (platform === 'PS') query += " AND platform IN ('PS', 'PlayStation', 'All-Platform')";
      else if (platform === 'XBOX') query += " AND platform IN ('XBOX', 'Xbox', 'All-Platform')";
      else {
        query += ' AND platform = ?';
        params.push(platform);
      }
    }
    query += ' ORDER BY scraped_at DESC';

    const listings = this._all(query, params);

    // Attach stats to each listing
    for (const listing of listings) {
      listing.stats = this._all(`
        SELECT stat_name as statName, stat_value as statValue, is_positive as isPositive, is_negative as isNegative, raw_label as rawLabel
        FROM listing_stats WHERE listing_id = ?
      `, [listing.id]);
    }

    return listings;
  }

  getDailyPriceHistory(modName, platform = null, days = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const dateLimitStr = dateLimit.toISOString().split('T')[0];

    let query = 'SELECT * FROM daily_prices WHERE mod_name = ? AND date >= ?';
    const params = [modName, dateLimitStr];

    if (platform && platform !== 'ALL') {
      if (platform === 'PC') query += " AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')";
      else if (platform === 'PS') query += " AND platform IN ('PS', 'PlayStation', 'All-Platform')";
      else if (platform === 'XBOX') query += " AND platform IN ('XBOX', 'Xbox', 'All-Platform')";
      else {
        query += ' AND platform = ?';
        params.push(platform);
      }
    }
    query += ' ORDER BY date ASC';

    return this._all(query, params);
  }

  getTodayPrices(modName, platform = null) {
    const d = new Date();
    const today = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let query = 'SELECT * FROM daily_prices WHERE mod_name = ? AND date = ?';
    const params = [modName, today];
    if (platform && platform !== 'ALL') {
      if (platform === 'PC') query += " AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')";
      else if (platform === 'PS') query += " AND platform IN ('PS', 'PlayStation', 'All-Platform')";
      else if (platform === 'XBOX') query += " AND platform IN ('XBOX', 'Xbox', 'All-Platform')";
      else {
        query += ' AND platform = ?';
        params.push(platform);
      }
    }
    return this._all(query, params);
  }

  // ── Predictive Estimator Operations ──

  getModuleBasePrice(modName, platform = null) {
    let query = 'SELECT price FROM listings WHERE mod_name = ?';
    const params = [modName];

    if (platform && platform !== 'ALL') {
      if (platform === 'PC') query += " AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')";
      else if (platform === 'PS') query += " AND platform IN ('PS', 'PlayStation', 'All-Platform')";
      else if (platform === 'XBOX') query += " AND platform IN ('XBOX', 'Xbox', 'All-Platform')";
      else {
        query += ' AND platform = ?';
        params.push(platform);
      }
    }

    const prices = this._all(query, params).map(r => r.price).sort((a, b) => a - b);
    return this._median(prices);
  }

  getStatGlobalPremium(statName, platform = null) {
    let platQuery = '';
    const paramsPlat = [];
    if (platform && platform !== 'ALL') {
      if (platform === 'PC') platQuery = " AND l.platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')";
      else if (platform === 'PS') platQuery = " AND l.platform IN ('PS', 'PlayStation', 'All-Platform')";
      else if (platform === 'XBOX') platQuery = " AND l.platform IN ('XBOX', 'Xbox', 'All-Platform')";
      else {
        platQuery = ' AND l.platform = ?';
        paramsPlat.push(platform);
      }
    }

    // Get all module names that have this stat
    const modsWithStat = this._all(`
      SELECT DISTINCT l.mod_name 
      FROM listings l
      JOIN listing_stats ls ON l.id = ls.listing_id
      WHERE ls.stat_name = ? ${platQuery}
    `, [statName, ...paramsPlat]).map(r => r.mod_name);

    if (modsWithStat.length === 0) return 0;

    let totalPremium = 0;
    let count = 0;

    for (const mod of modsWithStat) {
      const queryWith = `
        SELECT l.price FROM listings l
        JOIN listing_stats ls ON l.id = ls.listing_id
        WHERE l.mod_name = ? AND ls.stat_name = ? ${platQuery}
      `;
      const pricesWith = this._all(queryWith, [mod, statName, ...paramsPlat]).map(r => r.price).sort((a, b) => a - b);
      const medianWith = this._median(pricesWith);

      const queryWithout = `
        SELECT l.price FROM listings l
        WHERE l.mod_name = ? AND l.id NOT IN (
          SELECT listing_id FROM listing_stats WHERE stat_name = ?
        ) ${platQuery}
      `;
      const pricesWithout = this._all(queryWithout, [mod, statName, ...paramsPlat]).map(r => r.price).sort((a, b) => a - b);
      const medianWithout = this._median(pricesWithout);

      if (medianWithout > 0 && medianWith > 0) {
        const premium = (medianWith - medianWithout) / medianWithout;
        totalPremium += premium;
        count++;
      }
    }

    return count > 0 ? (totalPremium / count) : 0;
  }

  // ── Tracked Mods ──

  saveTrackedMod(modName, stats, platform = 'PC') {
    this._run('INSERT INTO tracked_mods (mod_name, stats, platform) VALUES (?, ?, ?)',
      [modName, JSON.stringify(stats), platform]);
    this.save();
  }

  getTrackedMods() {
    return this._all('SELECT * FROM tracked_mods ORDER BY created_at DESC').map(row => {
      row.stats = JSON.parse(row.stats || '[]');
      return row;
    });
  }

  deleteTrackedMod(id) {
    this._run('DELETE FROM tracked_mods WHERE id = ?', [id]);
    this.save();
  }

  // ── Maintenance ──

  getDbStats() {
    const totalListings = (this._get('SELECT COUNT(*) as c FROM listings') || {}).c || 0;
    const totalDays = (this._get('SELECT COUNT(DISTINCT date) as c FROM daily_prices') || {}).c || 0;
    const uniqueMods = (this._get('SELECT COUNT(DISTINCT mod_name) as c FROM listings') || {}).c || 0;
    const oldestScrape = (this._get('SELECT MIN(scraped_at) as d FROM listings') || {}).d || null;
    const newestScrape = (this._get('SELECT MAX(scraped_at) as d FROM listings') || {}).d || null;
    return { totalListings, totalDays, uniqueMods, oldestScrape, newestScrape };
  }
}

module.exports = { MarketDB };
