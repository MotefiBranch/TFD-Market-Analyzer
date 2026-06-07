# TFD Market Analyzer

A powerful, mathematically accurate market analysis tool for **The First Descendant**. 

This application serves as a desktop overlay companion that allows you to calculate the **true market value** of Ancestral Modules. By applying a weighted distribution to live market listings, this tool automatically filters out absurdly priced "god rolls" to show you exactly where the realistic market median and average prices land.

## Screenshots & Demo
*<img width="1392" height="891" alt="image 1" src="https://github.com/user-attachments/assets/82fb205c-2388-4b63-845e-651e3070af3b" /> 

https://github.com/user-attachments/assets/f3192ab3-cb39-49f1-95b9-ff1ade6f0a33

*

## Features

- **True Weighted Statistics**: Most price aggregators simply take the average of all unique price points. The TFD Market Analyzer weights prices by listing volume, ensuring that 200 listings at 20 Caliber carry vastly more mathematical weight than 1 listing at 2,000 Caliber.
- **Predictive Pricing Estimator**: When searching for highly specific or rare stat combinations (e.g., "HP Heal" + "Skill Cooldown") that currently have zero live listings, the analyzer leverages your historical database to calculate the global premium of those specific stats and intelligently estimates a True Market Value.
- **Listing Watchlist**: Track specific seller listings by clicking the star icon. The analyzer automatically cross-references your Watchlist against fresh market data to notify you if a tracked item's price changes or if it is sold/removed.
- **Character Optimization & God Rolls**: Search the global database for your specific Descendant, see their community-accepted God Roll stats, and instantly filter the market to find matching, equippable items.
- **Intelligent Stat Parsing**: Directly reads Nexon's hidden HTML properties to perfectly color-code standard buffs (Green), penalties/debuffs (Red), and multi-tier multiplicative bonuses (`[x]`), eliminating the confusion of the official market's generic text.
- **Attended Refresh Macros**: Features interactive "Refresh Favorites", "Refresh Watchlist", and "Refresh Database" loops. It safely queues up items and prompts you to confirm each one, allowing you to update your tracked modules in minutes while remaining technically "at the keyboard" to evade automated bot detection.
- **Stat Matcher**: Input your ideal stats and the tool will automatically parse and rank the live listings to find exactly what you are looking for.
- **Local Persistence**: All historical pricing data is saved securely to a local SQLite database, building a localized historical price trend chart the more you use it.

## ⚠️ Legal Disclaimer
**This project is for educational purposes only.** It uses an "Attended Macro" approach and web scraping to analyze market data. While designed to require physical user interaction for every action, utilizing third-party tools to interact with, scrape, or automate actions on Nexon's services strictly violates the [Nexon Terms of Service](https://www.nexon.com/en/legal/terms). 

Nexon explicitly forbids the use of "macros," "data mining," or any "robot, spider, site search/retrieval application." Using this tool puts your Nexon account at high risk of suspension or permanent termination. **Use this tool entirely at your own risk.** The developer assumes no responsibility for any account bans or actions taken by Nexon.

## How to Install & Run

1. Clone or download this repository.
2. Make sure you have [Node.js](https://nodejs.org/) installed.
3. Open a terminal in the folder and install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

## Usage Workflow

1. Open the app and click **Open Market Browser**.
2. A normal, visible browser window will appear pointing to `tfd.nexon.com/en/market`.
3. Search for a module, click it, and scroll down manually to load the listings.
4. Once you have scrolled down to load the items, switch back to the Analyzer app and click **Extract Loaded Data**.
5. The app will instantly read the page, calculate the statistics, and populate your charts!

## Build for Desktop

To compile this into a standalone `.exe` file that doesn't require the terminal:
```bash
npm run build:win
```

## Smart Duplicate Protection
- **No Unique Listing IDs:** Nexon's web market does not expose unique database IDs or serial numbers for items in their HTML DOM. To track items in the Watchlist and filter duplicates, this tool relies on a composite key (`SellerName` + `Stats` + `Price` + `RegistrationTime`). If a single seller lists multiple identical clones of the exact same item at the exact same time, the system will filter out the duplicates to keep your interface clean. However, if a seller genuinely lists multiple identical clones sequentially, the system accurately discerns the time difference and correctly displays them as separate valid listings!

## Credits & Acknowledgements

The "Auto-Scroll & Extract" workflow in this application was heavily inspired by the incredible open-source [tfd-market-helper](https://github.com/syphari/tfd-market-helper) Chrome Extension created by Syphari. We highly recommend checking out their extension if you prefer a browser-native scraping solution! They also have an Electron Application but just without the graphs and medians. Also The Ai coding tools that made this possible (i.e, this is built on vibes 😎)

## License
MIT License
