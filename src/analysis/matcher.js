/**
 * Fuzzy Stat Matcher — finds listings that best match user's target stats.
 * Implements a multi-tier matching system:
 *   1. Exact match (all stats present with same values)
 *   2. Partial match (same stat names, different values)
 *   3. Subset match (some stats match)
 */

class StatMatcher {
  /**
   * Score how well a listing matches the target stats.
   * @param {Array} targetStats - User's desired stats [{name, value, positive}]
   * @param {Array} listingStats - Listing's stats [{statName, statValue, isPositive}]
   * @returns {Object} { score, matchType, matchedStats, missingStats }
   */
  static scoreMatch(targetStats, listingStats) {
    if (!targetStats || targetStats.length === 0) {
      return { score: 100, matchType: 'any', matchedStats: [], missingStats: [] };
    }

    const normalizedTarget = targetStats.map(s => ({
      name: this._normalize(s.name),
      value: this._parseValue(s.value)[0] || null,
      maxValue: this._parseValue(s.maxValue)[0] || null,
      positive: s.positive !== false
    }));

    const normalizedListing = listingStats.map(s => {
      const nums = this._parseValue(s.statValue || s.stat_value || s.value || '');
      return {
        name: this._normalize(s.statName || s.stat_name || ''),
        value: nums[0] !== undefined ? nums[0] : null,
        maxValue: nums.length > 1 ? nums[1] : null,
        positive: s.isPositive || s.is_positive
      };
    });

    const matchedStats = [];
    const missingStats = [];
    let totalScore = 0;

    for (const target of normalizedTarget) {
      // Find best matching stat in listing
      const match = this._findBestMatch(target, normalizedListing);

      if (match) {
        const nameScore = match.nameScore;
        const valueScore = match.valueScore;
        const combinedScore = (nameScore * 0.6) + (valueScore * 0.4);

        matchedStats.push({
          targetName: target.name,
          targetValue: target.value,
          matchedName: match.stat.name,
          matchedValue: match.stat.value,
          matchedMaxValue: match.stat.maxValue,
          nameScore,
          valueScore,
          combinedScore
        });

        totalScore += combinedScore;
      } else {
        missingStats.push(target.name);
      }
    }

    const avgScore = normalizedTarget.length > 0
      ? (totalScore / normalizedTarget.length)
      : 100;

    // Penalize for missing stats
    const missingPenalty = missingStats.length / Math.max(normalizedTarget.length, 1);
    const finalScore = avgScore * (1 - missingPenalty * 0.5);

    // Determine match type
    let matchType = 'none';
    if (missingStats.length === 0 && matchedStats.every(m => m.nameScore === 100 && m.valueScore === 100)) {
      matchType = 'exact';
    } else if (missingStats.length === 0 && matchedStats.every(m => m.nameScore === 100)) {
      matchType = 'partial';
    } else if (matchedStats.length > 0) {
      matchType = 'subset';
    }

    return {
      score: Math.round(Math.max(0, Math.min(100, finalScore))),
      matchType,
      matchedStats,
      missingStats
    };
  }

  /**
   * Rank listings by how well they match target stats.
   * @param {Array} targetStats
   * @param {Array} listings - Listings with stats attached
   * @returns {Array} Listings sorted by match score, with score attached
   */
  static rankListings(targetStats, listings) {
    const scored = listings.map(listing => {
      const stats = listing.stats || [];
      const match = this.scoreMatch(targetStats, stats);
      return { ...listing, matchScore: match.score, matchType: match.matchType, matchDetails: match };
    });

    return scored.sort((a, b) => {
      // Sort by score descending, then by price ascending
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (a.price || 0) - (b.price || 0);
    });
  }

  // ── Private ──

  static _findBestMatch(target, listingStats) {
    let bestMatch = null;
    let bestScore = 0;

    for (const stat of listingStats) {
      const nameScore = this._nameMatchScore(target.name, stat.name);
      if (nameScore < 50) continue; // Too different

      const valueScore = this._valueMatchScore(target, stat);
      const combined = (nameScore * 0.6) + (valueScore * 0.4);

      if (combined > bestScore) {
        bestScore = combined;
        bestMatch = { stat, nameScore, valueScore };
      }
    }

    return bestMatch;
  }

  static _nameMatchScore(targetName, listingName) {
    if (targetName === listingName) return 100;

    // Check if one contains the other
    if (targetName.includes(listingName) || listingName.includes(targetName)) return 85;

    // Word-level overlap
    const targetWords = new Set(targetName.toLowerCase().split(/\s+/));
    const listingWords = new Set(listingName.toLowerCase().split(/\s+/));
    const intersection = [...targetWords].filter(w => listingWords.has(w));
    const union = new Set([...targetWords, ...listingWords]);

    if (union.size === 0) return 0;
    return Math.round((intersection.length / union.size) * 100);
  }

  static _valueMatchScore(target, stat) {
    if (target.value === null && target.maxValue === null) return 100; // User didn't specify values
    if (stat.value === null && stat.maxValue === null) return 50;

    let scores = [];
    if (target.value !== null) {
      if (stat.value !== null) {
        scores.push(this._computeProximity(target.value, stat.value));
      } else {
        scores.push(0);
      }
    }

    if (target.maxValue !== null) {
      // If stat only has one value (e.g., standard module), compare against that. If it has two (reactor), compare against max.
      const compareStat = stat.maxValue !== null ? stat.maxValue : stat.value;
      if (compareStat !== null) {
        scores.push(this._computeProximity(target.maxValue, compareStat));
      } else {
        scores.push(0);
      }
    }

    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  static _computeProximity(t, s) {
    if (t === s) return 100;
    const maxVal = Math.max(Math.abs(t), Math.abs(s), 1);
    const diff = Math.abs(t - s);
    return Math.round(Math.max(0, (1 - diff / maxVal) * 100));
  }

  static _normalize(str) {
    return (str || '').replace(/^\(\+\)|^\(\-\)/, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  }

  static _parseValue(val) {
    if (val === null || val === undefined || val === '') return [];
    // Stat values can be like "36.7%[+] 46.7%[+]", so we split by space and parse all numbers
    const parts = String(val).split(/\s+/);
    const nums = parts.map(p => {
      const num = parseFloat(p.replace(/[^0-9.\-]/g, ''));
      return isNaN(num) ? null : num;
    }).filter(n => n !== null);
    
    return nums;
  }
}

module.exports = { StatMatcher };
