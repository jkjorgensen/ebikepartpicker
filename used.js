/* eBikePartsPicker — Used Parts tab (community listings, v1).
   Listings live in data/used.json (hand-approved by Josh before they show).
   v1: no accounts, no on-site messaging, no payments — buyer and seller
   work it out directly, same as Facebook. Fitment chips come ONLY from the
   listing's own "fits" array — never guessed.

   Listing schema (data/used.json):
     {id, title, category (category id), fits ([bike ids]),
      condition ('like-new'|'good'|'worn'|'for-parts'),
      price (number, USD), location, posted ('YYYY-MM-DD'),
      seller, email, description, photos ([]) } */
/* $ is scoped inside app.js's IIFE, so each standalone file defines its own (quiz.js/compare.js do the same) */
function $(id){ return document.getElementById(id); }
function usedToast(msg){ var t=$('toast'); if(!t) return; t.textContent=msg; t.style.display='block';
  clearTimeout(t._h); t._h=setTimeout(function(){ t.style.display='none'; }, 3200); }
var USED_INBOX = 'ebikepartspicker@gmail.com';
var USED_JSON = 'data/used.json';
var USED_CONDITIONS = {'like-new':'Like new','good':'Good','worn':'Worn','for-parts':'For parts'};
var USED_LISTINGS = [];
var USED_LOADED = false;

/* main (non-sparse) catalog bikes — the 14 the builder covers */
function usedBikes(){
  return (typeof BIKES !== 'undefined' ? BIKES : []).filter(function(b){ return !b.sparse; });
}
function usedBikeName(id){
  var b = (typeof BIKES !== 'undefined' ? BIKES : []).filter(function(x){ return x.id===id; })[0];
  return b ? b.name : null; /* null = unknown id; caller skips the chip */
}
function usedCatName(id){
  var c = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).filter(function(x){ return x.id===id; })[0];
  return c ? c.name : null;
}
function usedMoney(p){
  if(p===null || p===undefined || p==='' || isNaN(+p)) return '—';
  return '$' + Number(p).toLocaleString('en-US');
}
function usedDate(s){
  if(!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if(!m) return s;
  var months = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
  return (months[m[2]]||m[2]) + ' ' + (+m[3]) + ', ' + m[1];
}

function loadUsed(done){
  if(USED_LOADED){ done(); return; }
  fetch(USED_JSON).then(function(r){
    if(!r.ok) throw new Error('http '+r.status);
    return r.json();
  }).then(function(j){
    USED_LISTINGS = (j && j.listings) ? j.listings : [];
    USED_LOADED = true; done();
  }).catch(function(){
    USED_LISTINGS = []; USED_LOADED = true; done(); /* graceful: empty state */
  });
}

/* ---------- filters ---------- */
function buildUsedFilters(){
  var host = $('usedFilters'); if(!host || host.dataset.built) return;
  host.dataset.built = '1';
  function field(label, el){
    var l = document.createElement('label'); l.className = 'ufield';
    var s = document.createElement('span'); s.textContent = label; l.appendChild(s);
    l.appendChild(el); host.appendChild(l); return el;
  }
  var bike = document.createElement('select'); bike.id = 'ufBike';
  bike.appendChild(new Option('All bikes', ''));
  usedBikes().forEach(function(b){ bike.appendChild(new Option(b.name, b.id)); });
  field('Bike', bike);
  var cat = document.createElement('select'); cat.id = 'ufCat';
  cat.appendChild(new Option('All categories', ''));
  (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).forEach(function(c){
    cat.appendChild(new Option(c.name, c.id));
  });
  field('Category', cat);
  var cond = document.createElement('select'); cond.id = 'ufCond';
  cond.appendChild(new Option('Any condition', ''));
  Object.keys(USED_CONDITIONS).forEach(function(k){
    cond.appendChild(new Option(USED_CONDITIONS[k], k));
  });
  field('Condition', cond);
  var max = document.createElement('input'); max.id = 'ufMax';
  max.type = 'text'; max.inputMode = 'decimal'; max.placeholder = 'No max';
  max.setAttribute('aria-label', 'Max price');
  field('Max price', max);
  var sort = document.createElement('select'); sort.id = 'ufSort';
  sort.appendChild(new Option('Newest first', 'new'));
  sort.appendChild(new Option('Price: low to high', 'lo'));
  sort.appendChild(new Option('Price: high to low', 'hi'));
  field('Sort', sort);
  host.addEventListener('change', renderUsedGrid);
  host.addEventListener('input', function(e){ if(e.target.id==='ufMax') renderUsedGrid(); });
}

function usedFiltered(){
  var bike = $('ufBike') ? $('ufBike').value : '';
  var cat = $('ufCat') ? $('ufCat').value : '';
  var cond = $('ufCond') ? $('ufCond').value : '';
  var maxRaw = $('ufMax') ? $('ufMax').value.trim().replace(/[$,]/g,'') : '';
  var max = maxRaw==='' ? null : +maxRaw;
  var sort = $('ufSort') ? $('ufSort').value : 'new';
  var out = USED_LISTINGS.filter(function(l){
    if(bike && (!l.fits || l.fits.indexOf(bike)<0)) return false;
    if(cat && l.category!==cat) return false;
    if(cond && l.condition!==cond) return false;
    if(max!==null && !isNaN(max) && (l.price===null || l.price===undefined || +l.price>max)) return false;
    return true;
  });
  out.sort(function(a,b){
    if(sort==='lo') return (+a.price||Infinity) - (+b.price||Infinity);
    if(sort==='hi') return (+b.price||-Infinity) - (+a.price||-Infinity);
    return String(b.posted||'') < String(a.posted||'') ? -1 : 1; /* newest first */
  });
  return out;
}

/* ---------- cards ---------- */
function usedCard(l){
  var card = document.createElement('div'); card.className = 'card';
  var ph = document.createElement('div'); ph.className = 'uphoto';
  ph.textContent = 'Seller photo';
  card.appendChild(ph);
  var body = document.createElement('div'); body.className = 'body';

  var top = document.createElement('div'); top.className = 'urow';
  var h = document.createElement('h3'); h.textContent = l.title || 'Used part';
  top.appendChild(h);
  var price = document.createElement('span'); price.className = 'uprice';
  price.textContent = usedMoney(l.price); top.appendChild(price);
  body.appendChild(top);

  var sub = document.createElement('p'); sub.className = 'blurb';
  var bits = [];
  var cn = usedCatName(l.category); if(cn) bits.push(cn);
  if(l.location) bits.push(l.location);
  sub.textContent = bits.join(' · ') || ' ';
  body.appendChild(sub);

  var fits = document.createElement('div'); fits.className = 'ufits';
  var fl = document.createElement('span'); fl.className = 'ufits-label'; fl.textContent = 'Fits:';
  fits.appendChild(fl);
  var any = false;
  (l.fits || []).forEach(function(id){
    var n = usedBikeName(id);
    if(!n) return; /* never guess — skip unknown ids */
    any = true;
    var chip = document.createElement('span'); chip.className = 'fitchip'; chip.textContent = n;
    fits.appendChild(chip);
  });
  if(!any){
    var unk = document.createElement('span'); unk.className = 'fitchip unknown';
    unk.textContent = 'Fitment unverified'; fits.appendChild(unk);
  }
  body.appendChild(fits);

  var meta = document.createElement('div'); meta.className = 'umeta';
  var badge = document.createElement('span'); badge.className = 'condbadge';
  badge.textContent = USED_CONDITIONS[l.condition] || 'Used';
  meta.appendChild(badge);
  var pd = document.createElement('span'); pd.className = 'uposted';
  pd.textContent = l.posted ? 'Listed ' + usedDate(l.posted) : '';
  meta.appendChild(pd);
  body.appendChild(meta);

  if(l.description){
    var d = document.createElement('p'); d.className = 'blurb'; d.textContent = l.description;
    body.appendChild(d);
  }

  var acts = document.createElement('div'); acts.className = 'uacts';
  if(l.email){
    var mail = document.createElement('a'); mail.className = 'buy';
    mail.href = 'mailto:' + l.email + '?subject=' + encodeURIComponent('Used part: ' + (l.title||''));
    mail.textContent = 'Contact seller'; mail.rel = 'noopener';
    acts.appendChild(mail);
  }
  var rep = document.createElement('a'); rep.className = 'link'; rep.href =
    'mailto:' + USED_INBOX + '?subject=' + encodeURIComponent('Listing report: ' + (l.title||l.id||''));
  rep.textContent = 'Report listing';
  acts.appendChild(rep);
  body.appendChild(acts);

  card.appendChild(body);
  return card;
}

function renderUsedGrid(){
  var grid = $('usedGrid'); if(!grid) return;
  grid.innerHTML = '';
  var empty = $('usedEmpty');
  var list = usedFiltered();
  if(!list.length){
    if(empty) empty.hidden = false;
    return;
  }
  if(empty) empty.hidden = true;
  list.forEach(function(l){ grid.appendChild(usedCard(l)); });
}

function renderUsed(){
  buildUsedFilters();
  var note = $('usedNote');
  if(note) note.textContent = 'Community listings, hand-approved before they go live. No payments here — buyer and seller work it out directly.';
  loadUsed(renderUsedGrid);
}

/* ---------- sell-a-part modal (mirrors the suggest-part modal) ---------- */
(function(){
  var overlay = $('sellOverlay');
  if(!overlay) return;
  var catSel = $('sellCat');
  (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).forEach(function(c){
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name;
    catSel.appendChild(o);
  });
  var fitsHost = $('sellFits');
  usedBikes().forEach(function(b){
    var l = document.createElement('label'); l.className = 'fitcheck';
    var c = document.createElement('input'); c.type = 'checkbox'; c.value = b.id;
    l.appendChild(c);
    var s = document.createElement('span'); s.textContent = b.name; l.appendChild(s);
    fitsHost.appendChild(l);
  });
  function open(){ overlay.hidden = false; document.body.style.overflow = 'hidden'; }
  function close(){ overlay.hidden = true; document.body.style.overflow = ''; }
  document.querySelectorAll('.sellOpen').forEach(function(b){
    b.addEventListener('click', open);
  });
  $('sellClose').addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !overlay.hidden) close(); });
  function val(id){ return $(id).value.trim(); }
  $('sellSubmit').addEventListener('click', function(){
    var err = $('sellErr');
    var checked = fitsHost.querySelectorAll('input:checked');
    if(!val('sellTitle') || !val('sellEmail') || !checked.length){
      err.hidden = false; return;
    }
    err.hidden = true;
    var fitNames = [];
    checked.forEach(function(c){
      var n = usedBikeName(c.value); if(n) fitNames.push(n);
    });
    var lines = [
      'Used part submission for eBikePartsPicker', '',
      'Part: ' + val('sellTitle'),
      'Category: ' + (catSel.options[catSel.selectedIndex]
        ? catSel.options[catSel.selectedIndex].text : '—'),
      'Fits: ' + (fitNames.length ? fitNames.join(', ') : '—'),
      'Condition: ' + USED_CONDITIONS[$('sellCond').value],
      'Asking price: ' + (val('sellPrice') ? '$' + val('sellPrice') : '—'),
      'Location: ' + (val('sellLoc') || '—'),
      'Seller: ' + (val('sellName') || '—'),
      'Contact email: ' + val('sellEmail'), '',
      'Description: ' + (val('sellDesc') || '—'), '',
      'Note: seller will email photos separately.'
    ];
    var text = lines.join('\n');
    $('sellPreview').textContent = text;
    $('sellMail').href = 'mailto:' + USED_INBOX +
      '?subject=' + encodeURIComponent('Used part submission: ' + val('sellTitle')) +
      '&body=' + encodeURIComponent(text);
    $('sellForm').hidden = true;
    $('sellDone').hidden = false;
    $('sellCopy').onclick = function(){
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function(){ usedToast('Copied — send it our way!'); },
              function(){ usedToast('Copy failed — select the text manually.'); });
    };
  });
  $('sellAgain').addEventListener('click', function(){
    $('sellDone').hidden = true;
    $('sellForm').hidden = false;
    ['sellTitle','sellPrice','sellLoc','sellName','sellEmail','sellDesc'].forEach(function(id){ $(id).value = ''; });
    catSel.value = '';
    fitsHost.querySelectorAll('input:checked').forEach(function(c){ c.checked = false; });
  });
})();
