class Estimator {
  /**
   * Estimate the true market value of a module with specific stats.
   * @param {Object} db - The MarketDB instance
   * @param {string} modName - The name of the module
   * @param {Array} requestedStats - Array of stat names (e.g. ['HP Heal', 'Cooldown'])
   * @param {string} platform - The platform filter
   * @returns {Object} Estimated summary metrics
   */
  static estimatePrice(db, modName, requestedStats, platform = 'PC') {
    // 1. Get Base Price
    const basePrice = db.getModuleBasePrice(modName, platform);
    
    // If we literally have zero history of this module at all, we can't estimate.
    if (basePrice <= 0) {
      return this._zeroSummary();
    }

    // 2. Calculate Premium Multiplier
    let premiumMultiplier = 1.0;
    
    for (const stat of requestedStats) {
      // Get global premium for this stat (e.g., 0.20 means it adds 20% value)
      const premium = db.getStatGlobalPremium(stat, platform);
      
      // We add 1.0 to the premium. E.g. if premium is 0.2, multiplier becomes 1.2
      // If a module has two 20% premium stats, it becomes 1 * 1.2 * 1.2 = 1.44x multiplier
      if (premium !== 0) {
        premiumMultiplier *= (1 + premium);
      }
    }

    const estimatedValue = Math.round(basePrice * premiumMultiplier);

    // 3. Return a Summary Object matching the structure of PricingCalculator.computeSummary
    return {
      current: estimatedValue,
      avg7d: estimatedValue,
      avg30d: estimatedValue,
      change1d: 0,
      change7d: 0,
      change30d: 0,
      trend: 'stable',
      volatility: 0,
      minPrice: estimatedValue,
      maxPrice: estimatedValue,
      listingCount: 0,
      isEstimate: true,
      basePrice: basePrice,
      premiumMultiplier: premiumMultiplier
    };
  }

  static _zeroSummary() {
    return {
      current: 0, avg7d: 0, avg30d: 0, change1d: 0, change7d: 0, change30d: 0, 
      trend: 'stable', volatility: 0, minPrice: 0, maxPrice: 0, listingCount: 0,
      isEstimate: true, basePrice: 0, premiumMultiplier: 1.0
    };
  }
}

module.exports = { Estimator };
