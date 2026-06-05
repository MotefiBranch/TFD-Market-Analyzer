# TFD Market Analyzer

A powerful, mathematically accurate market analysis tool for **The First Descendant**. 

This application serves as a desktop overlay companion that allows you to calculate the **true market value** of Ancestral Modules. By applying a weighted distribution to live market listings, this tool automatically filters out absurdly priced "god rolls" to show you exactly where the realistic market median and average prices land.

## Features

- **True Weighted Statistics**: Most price aggregators simply take the average of all unique price points. The TFD Market Analyzer weights prices by listing volume, ensuring that 200 listings at 20 Caliber carry vastly more mathematical weight than 1 listing at 2,000 Caliber.
- **Manual "ToS-Safe" Extraction**: To respect Nexon's Terms of Service and anti-bot protections, this tool contains **zero headless automation or background scraping**. You open the built-in Market Browser, navigate the site exactly as a human would, and click "Extract" to instantly run analytics on whatever is loaded on your screen.
- **Stat Matcher**: Input your ideal stats (e.g., Skill Cooldown, HP Heal) and the tool will automatically parse and rank the live listings to find exactly what you are looking for.
- **Local Persistence**: All historical pricing data is saved securely to a local SQLite database, building a localized historical price trend chart the more you use it.

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

## Credits & Acknowledgements

The "Auto-Scroll & Extract" workflow in this application was heavily inspired by the incredible open-source [tfd-market-helper](https://github.com/syphari/tfd-market-helper) Chrome Extension created by Syphari. We highly recommend checking out their extension if you prefer a browser-native scraping solution!

## License
MIT License
