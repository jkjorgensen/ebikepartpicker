/* eBikePartsPicker — "Versus" bike comparison (v3.12.0)
   Standalone module: pick up to 3 bikes, compare specs side by side.
   Reads BIKES from data.js, est. range from quiz.js when present. */
(function(){
"use strict";
function $(id){ return document.getElementById(id); }
function money(n){ if(n==null) return 'TBD';
  var c=(n%1)?2:0;
  return n.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:c,maximumFractionDigits:c}); }
function bikeById(id){ return (window.BIKES||[]).find(function(b){ return b.id===id; }) || null; }
function el(tag, cls, text){
  var d = document.createElement(tag);
  if(cls) d.className = cls;
  if(text!=null) d.textContent = text;
  return d;
}
function sizeLabel(b){
  if(b.size==='light') return 'Lightweight';
  if(b.size==='mid') return 'Mid-size';
  if(b.size==='full') return 'Full-size';
  return 'Unlisted';
}
function estRange(bike){
  var q = window.__quiz;
  if(q && q.QUIZ_RANGE && q.QUIZ_RANGE[bike.id]!=null) return q.QUIZ_RANGE[bike.id];
  return null;
}

var cmp = { bikes: ['ultrabee', 'mx5', null] };

/* ---------- mini searchable picker ---------- */
function picker(host, idx){
  var box = el('div','combobox cmp-pick');
  var input = document.createElement('input');
  input.type = 'text'; input.placeholder = 'Type a bike…'; input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Compare bike '+(idx+1));
  var list = el('div','combo-list'); list.hidden = true;
  box.appendChild(input); box.appendChild(list); host.appendChild(box);
  var cur = cmp.bikes[idx] ? bikeById(cmp.bikes[idx]) : null;
  if(cur) input.value = cur.name;
  function close(){ list.hidden = true; }
  function renderItems(){
    var q = input.value.trim().toLowerCase();
    var sf = window.__bikeSizeFilter;
    var matches = (window.BIKES||[]).filter(function(b){
      if(sf && sf!=='all' && b.size!==sf) return false;
      return !q || b.name.toLowerCase().indexOf(q)!==-1;
    });
    list.innerHTML = '';
    if(!matches.length){
      list.appendChild(el('div','combo-empty','No bikes match — try another search.'));
    } else {
      matches.forEach(function(b){
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'combo-item';
        btn.appendChild(el('span','', b.name));
        var meta = el('span','combo-price', (b.size?sizeLabel(b)+' · ':'')+money(b.price));
        btn.appendChild(meta);
        btn.addEventListener('mousedown', function(e){
          e.preventDefault();
          cmp.bikes[idx] = b.id; input.value = b.name; close(); input.blur();
          renderCompare();
        });
        list.appendChild(btn);
      });
    }
    list.hidden = false;
  }
  input.addEventListener('input', renderItems);
  input.addEventListener('focus', function(){ input.select(); renderItems(); });
  input.addEventListener('blur', function(){ setTimeout(close, 150); });
  input.addEventListener('keydown', function(e){
    if(e.key==='Enter'){
      var q = input.value.trim().toLowerCase();
      var m = (window.BIKES||[]).filter(function(b){ return b.name.toLowerCase().indexOf(q)!==-1; });
      if(m.length){ cmp.bikes[idx] = m[0].id; input.value = m[0].name; renderCompare(); }
      close(); input.blur();
    } else if(e.key==='Escape'){ close(); input.blur(); }
  });
  document.addEventListener('click', function(e){
    if(!box.contains(e.target)) close();
  });
  var clr = el('button','link cmp-clear','Clear');
  clr.addEventListener('click', function(){ cmp.bikes[idx] = null; input.value=''; renderCompare(); });
  host.appendChild(clr);
}

/* ---------- comparison table ---------- */
function bestIdx(bikes, fn, higher){
  var bi = -1, bv = null;
  bikes.forEach(function(b, i){
    if(!b) return;
    var v = fn(b);
    if(v==null) return;
    if(bv==null || (higher ? v>bv : v<bv)){ bv = v; bi = i; }
  });
  return bi;
}
function renderCompare(){
  var host = $('compareBody'); host.innerHTML = '';
  var wrap = el('div','qwrap cmp-wrap');
  wrap.appendChild(el('div','qstep','Head to head'));
  wrap.appendChild(el('h2','qtitle','Versus: compare e-motos.'));
  wrap.appendChild(el('p','qsub','Pick up to three bikes. Green marks the best figure in each row — lowest price, lightest weight, most power, longest estimated range. Prices are snapshots, range is an owner-average estimate.'));

  var picks = el('div','cmp-picks');
  for(var i=0;i<3;i++){
    var slot = el('div','cmp-slot');
    slot.appendChild(el('div','qkicker','Bike '+(i+1)));
    picker(slot, i);
    picks.appendChild(slot);
  }
  wrap.appendChild(picks);

  var bikes = cmp.bikes.map(function(id){ return id ? bikeById(id) : null; });
  if(!bikes.some(Boolean)){
    wrap.appendChild(el('p','qnote','Pick a bike above to start comparing.'));
    host.appendChild(wrap); window.scrollTo(0,0); return;
  }
  var table = el('table','cmp-table');
  var thead = document.createElement('thead');
  var hr = document.createElement('tr');
  hr.appendChild(el('th','cmp-rowh',''));
  bikes.forEach(function(b){
    var th = document.createElement('th');
    if(b){
      var im = document.createElement('img');
      im.src = 'img/bike-'+b.id+'.png'; im.alt = b.name; im.loading = 'lazy';
      im.onerror = function(){ im.style.display='none'; };
      th.appendChild(im);
      th.appendChild(el('div','cmp-bname', b.name));
      var ob = el('button','ghostbtn cmp-open','Open in builder');
      (function(id){ ob.addEventListener('click', function(){
        if(typeof window.openBikeInBuilder==='function') window.openBikeInBuilder(id);
      }); })(b.id);
      th.appendChild(ob);
    } else {
      th.appendChild(el('span','cmp-empty','—'));
    }
    hr.appendChild(th);
  });
  thead.appendChild(hr); table.appendChild(thead);

  var rows = [
    { label:'Price', fn:function(b){ return b.price; }, higher:false,
      fmt:function(b){ return b.price!=null ? money(b.price) : 'TBD'; } },
    { label:'Weight', fn:function(b){ return b.weight; }, higher:false,
      fmt:function(b){ return b.weight!=null ? b.weight+' lb' : 'unverified'; } },
    { label:'Peak power', fn:function(b){ return b.kw; }, higher:true,
      fmt:function(b){ return b.kw!=null ? b.kw+' kW' : 'unverified'; } },
    { label:'Est. range', fn:estRange, higher:true,
      fmt:function(b){ var r=estRange(b); return r!=null ? '~'+r+' mi' : 'unknown'; } },
    { label:'Size class', fn:null, higher:false,
      fmt:function(b){ return sizeLabel(b); } }
  ];
  var tbody = document.createElement('tbody');
  rows.forEach(function(r){
    var tr = document.createElement('tr');
    tr.appendChild(el('th','cmp-rowh', r.label));
    var bi = r.fn ? bestIdx(bikes, r.fn, r.higher) : -1;
    bikes.forEach(function(b, i){
      var td = document.createElement('td');
      if(b){
        td.textContent = r.fmt(b);
        if(i===bi) td.className = 'best';
      } else td.textContent = '—';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  var tscroll = el('div','cmp-scroll');
  tscroll.appendChild(table);
  wrap.appendChild(tscroll);
  wrap.appendChild(el('p','qnote','Range figures are owner-reported averages / rough estimates, not guarantees. Real-world range varies with rider weight, terrain, speed, temperature and riding style.'));
  host.appendChild(wrap);
  window.scrollTo(0,0);
}

/* ---------- tab wiring (same pattern as quiz.js) ---------- */
function showComparePane(){
  if($('start')) $('start').hidden = true;
  if($('app')) $('app').hidden = false;
  ['tabBuilder','tabBuilds','tabUpcoming','tabQuiz'].forEach(function(id){
    var t = $(id); if(t) t.classList.remove('on');
  });
  var tc = $('tabCompare'); if(tc) tc.classList.add('on');
  ['builderPane','buildsPane','upcomingPane','quizPane'].forEach(function(id){
    var p = $(id); if(p) p.hidden = true;
  });
  var cp = $('comparePane'); if(cp) cp.hidden = false;
  window.scrollTo(0,0);
}
function hideComparePane(){
  var cp = $('comparePane'); if(cp) cp.hidden = true;
  var tc = $('tabCompare'); if(tc) tc.classList.remove('on');
}
function init(){
  if(window.__compareInit) return; window.__compareInit = true;
  var tc = $('tabCompare');
  if(tc) tc.addEventListener('click', function(){ showComparePane(); renderCompare(); });
  ['tabBuilder','tabBuilds','tabUpcoming','tabQuiz'].forEach(function(id){
    var t = $(id);
    if(t) t.addEventListener('click', hideComparePane);
  });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

window.__compare = { renderCompare:renderCompare, cmp:cmp, sizeLabel:sizeLabel, bestIdx:bestIdx };
})();
