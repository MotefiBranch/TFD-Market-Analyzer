const fs = require('fs');
const initSqlJs = require('sql.js');

async function test() {
  const filebuffer = fs.readFileSync(process.env.APPDATA + '/tfd-market-analyzer/data/market.sqlite');
  const SQL = await initSqlJs();
  const db = new SQL.Database(filebuffer);
  
  const res = db.exec(`SELECT price, count(*) as count FROM listings WHERE mod_name = "Grenadier's Resolution" AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform') GROUP BY price ORDER BY price ASC`);
  console.log('Price Distribution:', JSON.stringify(res, null, 2));

  const total = db.exec(`SELECT count(*) as count FROM listings WHERE mod_name = "Grenadier's Resolution" AND platform IN ('PC', 'Steam', 'STEAM', 'All-Platform')`);
  console.log('Total Count:', JSON.stringify(total, null, 2));
}
test().catch(console.error);
