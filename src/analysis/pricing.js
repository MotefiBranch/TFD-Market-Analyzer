/**
 * Pricing Calculator — median, average, % change computations.
 */

class PricingCalculator {
  /**
   * Calculate median of a sorted array.
   */
  static median(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate average.
   */
  static average(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  /**
   * Calculate percentage change between two values.
   * @returns {number} Percentage change (e.g., 5.2 for +5.2%)
   */
  static percentChange(oldVal, newVal) {
    if (!oldVal || oldVal === 0) return 0;
    return ((newVal - oldVal) / oldVal) * 100;
  }

  /**
   * Aggregate multiple stat-combo rows per date into a single row per date.
   */
  static aggregateByDate(dailyPrices) {
    if (!dailyPrices || dailyPrices.length === 0) return [];
    const byDate = {};
    for (const d of dailyPrices) {
      if (!byDate[d.date]) byDate[d.date] = { prices: [], mins: [], maxs: [], count: 0 };
      
      // WEIGHTED DISTRIBUTION: Recreate the true volume curve by inserting the price N times
      for (let i = 0; i < d.listing_count; i++) {
        byDate[d.date].prices.push(d.median_price);
      }
      
      byDate[d.date].mins.push(d.min_price);
      byDate[d.date].maxs.push(d.max_price);
      byDate[d.date].count += d.listing_count;
    }
    return Object.keys(byDate).sort().map(date => {
      const g = byDate[date];
      return {
        date,
        median_price: this.median(g.prices),
        avg_price: this.average(g.prices),
        min_price: Math.min(...g.mins),
        max_price: Math.max(...g.maxs),
        listing_count: g.count
      };
    });
  }

  /**
   * Get price summary for a set of daily price records.
   * @param {Array} dailyPrices - Array from getDailyPriceHistory()
   * @returns {Object} Summary with current, 7d, 30d metrics
   */
  static computeSummary(dailyPrices) {
    const aggregated = this.aggregateByDate(dailyPrices);
    if (aggregated.length === 0) {
      return { current: 0, avg7d: 0, avg30d: 0, change1d: 0, change7d: 0, change30d: 0, trend: 'stable', volatility: 0, minPrice: 0, maxPrice: 0, listingCount: 0 };
    }

    const sorted = aggregated; // already sorted by date string lexicographically
    const latest = sorted[sorted.length - 1];
    const current = latest.median_price;

    // Yesterday
    const yesterday = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const change1d = yesterday ? this.percentChange(yesterday.median_price, current) : 0;

    // 7-day average
    const last7 = sorted.slice(-7);
    const avg7d = Math.round(this.average(last7.map(d => d.median_price)));
    const first7 = last7[0];
    const change7d = first7 ? this.percentChange(first7.median_price, current) : 0;

    // 30-day average
    const avg30d = Math.round(this.average(sorted.map(d => d.median_price)));
    const first30 = sorted[0];
    const change30d = first30 ? this.percentChange(first30.median_price, current) : 0;

    // Volatility (std dev of daily median prices)
    const prices = sorted.map(d => d.median_price);
    const mean = this.average(prices);
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);

    // Trend direction
    let trend = 'stable';
    if (last7.length >= 3) {
      const recentAvg = this.average(last7.slice(-3).map(d => d.median_price));
      const olderAvg = this.average(last7.slice(0, 3).map(d => d.median_price));
      const trendPct = this.percentChange(olderAvg, recentAvg);
      if (trendPct > 3) trend = 'rising';
      else if (trendPct < -3) trend = 'falling';
    }

    // Global min/max
    const allMin = Math.min(...sorted.map(d => d.min_price));
    const allMax = Math.max(...sorted.map(d => d.max_price));
    const totalListings = sorted.reduce((s, d) => s + d.listing_count, 0);

    return {
      current: Math.round(current),
      avg7d,
      avg30d,
      change1d: Math.round(change1d * 100) / 100,
      change7d: Math.round(change7d * 100) / 100,
      change30d: Math.round(change30d * 100) / 100,
      trend,
      volatility: Math.round(volatility),
      minPrice: allMin,
      maxPrice: allMax,
      listingCount: totalListings
    };
  }
}

module.exports = { PricingCalculator };
