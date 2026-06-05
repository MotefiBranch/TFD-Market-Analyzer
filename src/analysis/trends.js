/**
 * Trend Computation — builds chart-ready datasets from daily price history.
 */

const { PricingCalculator } = require('./pricing');

class TrendComputer {
  /**
   * Build chart data for 30-day, 7-day, and today views.
   * @param {Array} dailyPrices - Raw daily_prices rows from DB
   * @returns {Object} { thirtyDay, sevenDay, today }
   */
  static buildChartData(dailyPrices) {
    if (!dailyPrices || dailyPrices.length === 0) {
      return { thirtyDay: this._empty(), sevenDay: this._empty(), today: this._empty() };
    }

    const aggregated = PricingCalculator.aggregateByDate(dailyPrices);

    return {
      thirtyDay: this._buildPeriod(aggregated, 30),
      sevenDay: this._buildPeriod(aggregated, 7),
      today: this._buildToday(aggregated)
    };
  }

  static _buildPeriod(sorted, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const filtered = sorted.filter(d => d.date >= cutoffStr);

    if (filtered.length === 0) return this._empty();

    const labels = filtered.map(d => this._formatDate(d.date));
    const medianLine = filtered.map(d => d.median_price);
    const minBand = filtered.map(d => d.min_price);
    const maxBand = filtered.map(d => d.max_price);
    const avgLine = filtered.map(d => Math.round(d.avg_price));
    const counts = filtered.map(d => d.listing_count);

    // Calculate daily % changes
    const changes = filtered.map((d, i) => {
      if (i === 0) return 0;
      const prev = filtered[i - 1].median_price;
      return prev > 0 ? Math.round(((d.median_price - prev) / prev) * 10000) / 100 : 0;
    });

    return { labels, medianLine, minBand, maxBand, avgLine, counts, changes, raw: filtered };
  }

  static _buildToday(sorted) {
    const today = new Date().toISOString().split('T')[0];
    const todayData = sorted.filter(d => d.date === today);

    if (todayData.length === 0) {
      // Fall back to the most recent day
      const latest = sorted[sorted.length - 1];
      return {
        labels: [this._formatDate(latest.date)],
        medianLine: [latest.median_price],
        minBand: [latest.min_price],
        maxBand: [latest.max_price],
        avgLine: [Math.round(latest.avg_price)],
        counts: [latest.listing_count],
        changes: [0],
        raw: [latest]
      };
    }

    return {
      labels: todayData.map(d => 'Today'),
      medianLine: todayData.map(d => d.median_price),
      minBand: todayData.map(d => d.min_price),
      maxBand: todayData.map(d => d.max_price),
      avgLine: todayData.map(d => Math.round(d.avg_price)),
      counts: todayData.map(d => d.listing_count),
      changes: [0],
      raw: todayData
    };
  }

  static _formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  static _empty() {
    return { labels: [], medianLine: [], minBand: [], maxBand: [], avgLine: [], counts: [], changes: [], raw: [] };
  }
}

module.exports = { TrendComputer };
