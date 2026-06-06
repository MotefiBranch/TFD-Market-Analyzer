/**
 * DOM Parser for TFD Market Page.
 * Adapted from syphari/tfd-market-helper popup.js.
 * Self-contained for page.evaluate() injection.
 */

function parseMarketPage() {
  function parseAncestor(item) {
    const gt = (s) => { const e = item.querySelector(s); return e ? e.textContent.trim() : ''; };
    const name = gt('.row-wrapper .name') || gt('.module-name');
    const category = gt('.row-wrapper .type');
    let socketType = '';
    const si = item.querySelector('.ancestor-info .socket-type');
    if (si) socketType = si.textContent.trim();
    else { const s2 = item.querySelector('.item__info .socket-type'); if (s2) socketType = s2.textContent.trim(); }
    const requiredRank = gt('.ancestor-info .required-rank span');
    const platform = gt('.seller .platform');
    const rerollCount = gt('.seller .reroll span');
    let sellerName = '', sellerStatus = '';
    const nk = item.querySelector('.seller .nickname');
    if (nk) {
      if (nk.childNodes && nk.childNodes.length > 0) {
        const fn = nk.childNodes[0];
        sellerName = fn.nodeType === Node.TEXT_NODE ? fn.textContent.trim() : nk.textContent.trim();
      }
      const st = nk.querySelector('i');
      if (st) sellerStatus = st.textContent.trim();
    }
    const sellerRank = gt('.seller .rank span');
    const pe = item.querySelector('.price');
    let price = '';
    if (pe) {
      price = Array.from(pe.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).join(' ');
      if (!price) price = pe.textContent.trim();
    }
    const attributes = [], stats = [];
    item.querySelectorAll('.item__details .option').forEach(opt => {
      const ne = opt.querySelector('.option-name'), ve = opt.querySelector('.option-value');
      if (!ne) return;
      const lr = ne.textContent.trim();
      const pos = opt.className.includes('advantage') || lr.startsWith('(+)');
      const neg = opt.className.includes('penalty') || lr.startsWith('(-)');
      let an = lr.replace(/^\(\+\)|^\(\-\)/, '').split('[')[0].trim();
      if (an && !attributes.includes(an)) attributes.push(an);
      stats.push({ raw: lr, positive: pos, negative: neg, value: ve ? ve.textContent.trim() : '' });
    });
    const availableCharacters = [];
    item.querySelectorAll('.available-character img').forEach(img => {
      const name = img.getAttribute('alt');
      const src = img.getAttribute('src');
      if (name && src) availableCharacters.push({ name, src });
    });
    return { name, category, socketType, requiredRank, price, platform, rerollCount, sellerName, sellerStatus, sellerRank, regDate: gt('.information .date span'), attributes, stats, availableCharacters };
  }

  function parseTrigger(item) {
    const gt = (s) => { const e = item.querySelector(s); return e ? e.textContent.trim() : ''; };
    const name = gt('.row-wrapper .name') || gt('.module-name');
    const category = gt('.row-wrapper .type');
    let requiredRank = '';
    const rs = item.querySelector('.item__info .required-mastery-rank span, .item__info .required-rank span');
    if (rs) requiredRank = rs.textContent.trim();
    const platform = gt('.seller .platform');
    const rerollCount = gt('.seller .reroll span');
    let sellerName = '', sellerStatus = '';
    const nk = item.querySelector('.seller .nickname');
    if (nk) {
      if (nk.childNodes && nk.childNodes.length > 0) {
        const fn = nk.childNodes[0];
        sellerName = fn.nodeType === Node.TEXT_NODE ? fn.textContent.trim() : nk.textContent.trim();
      }
      const st = nk.querySelector('i');
      if (st) sellerStatus = st.textContent.trim();
    }
    const sellerRank = gt('.seller .rank span');
    const pe = item.querySelector('.price');
    let price = '';
    if (pe) {
      price = Array.from(pe.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).join(' ');
      if (!price) price = pe.textContent.trim();
    }
    const attributes = [], stats = [];
    item.querySelectorAll('.item__details .option').forEach(opt => {
      const ne = opt.querySelector('.option-name'), ve = opt.querySelector('.option-value');
      const lt = ne ? ne.textContent.trim() : '', vt = ve ? ve.textContent.trim() : '';
      const pos = opt.className.includes('advantage');
      const neg = opt.className.includes('penalty');
      let an = lt.split('(')[0].trim();
      if (an && !attributes.includes(an)) attributes.push(an);
      stats.push({ raw: lt + ' ' + vt, positive: pos, negative: neg, value: vt });
    });
    return { name, category, socketType: '', requiredRank, price, platform, rerollCount, sellerName, sellerStatus, sellerRank, regDate: gt('.information .date span'), attributes, stats };
  }

  const modules = [];
  const items = document.querySelectorAll('.items .item');
  items.forEach(item => {
    const te = item.querySelector('.row-wrapper .type');
    const cat = te ? te.textContent.trim() : '';
    const mod = cat.toLowerCase().includes('trigger') ? parseTrigger(item) : parseAncestor(item);
    if (mod.name || mod.price) modules.push(mod);
  });
  return modules;
}

module.exports = { parseMarketPage };
