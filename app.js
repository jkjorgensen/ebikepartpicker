/* eBikePartsPicker v3 — builder logic. Reads BIKES/CATEGORIES from data.js,
   BUILDS/GUIDES from builds.js. */
(function(){
"use strict";
var HP_PER_KW = 1.341;
var state = { bike: 'ventus-plus', sel: {}, step: 0 };
function totalSteps(){ return GROUPS.length + 1; } /* parts + review */
/* Builder steps, grouped so there are 7 pages instead of 22. Little parts live in Extras at the end. */
var GROUPS = [
  {name:'Powertrain', cats:['motor','controller','batteries','charger','cooling','electrical']},
  {name:'Suspension', cats:['fork','shock','linkage']},
  {name:'Wheels & Brakes', cats:['wheels','tires','brakes']},
  {name:'Drivetrain', cats:['drivetrain','swingarm']},
  {name:'Body', cats:['plastics','seat','guards']},
  {name:'Cockpit', cats:['handlebar','cockpit','pegs']},
  {name:'Extras', cats:['street','maintenance','titanium']},
];
function catById(id){ return CATEGORIES.find(function(c){return c.id===id;}) || null; }

function $(id){ return document.getElementById(id); }
function money(n){ if(n==null) return 'TBD'; var c=(n%1)?2:0;
  return n.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:c,maximumFractionDigits:c}); }
function bike(){ return BIKES.find(function(b){return b.id===state.bike;}) || BIKES[0]; }
function bikeById(id){ return BIKES.find(function(b){return b.id===id;}); }
function catById(id){ return CATEGORIES.find(function(c){return c.id===id;}); }
function catOption(cat){ return cat.options[state.sel[cat.id]||0] || cat.options[0]; }

/* lowest-price vendor entry for an option, or null */
function best(opt){
  if(!opt.prices || !opt.prices.length) return null;
  var af = opt.prices.filter(function(p){ return p.aff; });
  if(af.length) return af[0]; /* affiliate partner link is primary */
  return opt.prices.reduce(function(a,b){ return b.p < a.p ? b : a; });
}
function optPrice(opt){ var b = best(opt); return b ? b.p : 0; }

/* 'yes' | 'likely' | 'no' */
function fitLevel(opt, bikeId){
  if(!opt.fits || opt.fits==='universal') return 'yes';
  if(opt.fits.indexOf(bikeId) !== -1) return 'yes';
  if(opt.likely && opt.likely.indexOf(bikeId) !== -1) return 'likely';
  if(opt.no && opt.no.indexOf(bikeId) !== -1) return 'no';
  var b = bikeById(bikeId);
  if(b && b.sparse) return 'likely'; /* new bike, fitment not researched yet — show as verify */
  return 'no';
}

/* ---------- compatibility rules engine ----------
   Deterministic: unknown fitment NEVER returns a confirmed fit.
   Statuses: direct_fit | fits_with_hardware | requires_modification |
             incompatible | unverified */
var FIT_LABEL = {
  direct_fit:'Direct fit', fits_with_hardware:'Fits with hardware',
  requires_modification:'Fits with modification', incompatible:'Not compatible',
  unverified:'Unverified fitment'
};
var FIT_ICON = {
  direct_fit:'\u2713', fits_with_hardware:'\u25CB', requires_modification:'\u25CB',
  incompatible:'\u2717', unverified:'?'
};
function fitEvidence(pid, bikeId){
  if(!pid || !window.FITMENT) return null;
  return window.FITMENT[pid+'|'+bikeId] || null;
}
function checkFit(bikeId, opt){
  if(!opt || !opt.pid) return {status:'unverified',
    reasons:['No fitment data for this entry.'], evidence:[], checked:CHECKED};
  if(opt.fits === 'universal') return {status:'direct_fit',
    reasons:['Seller lists this as a universal-fit part.'], evidence:[], checked:CHECKED};
  var d = fitEvidence(opt.pid, bikeId);
  if(d){
    var ev = d.u || [];
    if(d.s === 'confirmed_direct_fit') return {status:'direct_fit',
      reasons:[d.n || 'Seller documents fitment for this exact bike.'], evidence:ev, checked:CHECKED};
    if(d.s === 'confirmed_fit_with_adapter') return {status:'fits_with_hardware',
      reasons:[d.n || 'Fits with the adapter/hardware noted by the seller.'], evidence:ev, checked:CHECKED};
    if(d.s === 'confirmed_fit_with_modifications') return {status:'requires_modification',
      reasons:[d.n || 'Fits with the modifications noted by the seller.'], evidence:ev, checked:CHECKED};
    if(d.s === 'not_compatible') return {status:'incompatible',
      reasons:[d.n || 'Known fitment conflict for this bike.'], evidence:ev, checked:CHECKED};
    return {status:'unverified',
      reasons:[d.n || 'Fitment not confirmed — verify before buying.'], evidence:ev, checked:CHECKED};
  }
  if(opt.fits && opt.fits.indexOf(bikeId) !== -1) return {status:'direct_fit',
    reasons:['Listed as compatible with this bike.'], evidence:[], checked:CHECKED};
  if(opt.likely && opt.likely.indexOf(bikeId) !== -1) return {status:'unverified',
    reasons:['Likely fits but not confirmed — verify before buying.'], evidence:[], checked:CHECKED};
  if(opt.no && opt.no.indexOf(bikeId) !== -1) return {status:'incompatible',
    reasons:['Not compatible with this bike.'], evidence:[], checked:CHECKED};
  var b = bikeById(bikeId);
  if(b && b.sparse) return {status:'unverified',
    reasons:['Fitment not yet researched for this bike.'], evidence:[], checked:CHECKED};
  return {status:'unverified',
    reasons:['No fitment information for this bike — not confirmed.'], evidence:[], checked:CHECKED};
}
function previewSrc(){
  var b = bike();
  /* Stock photo only: the AI part-swap composites had mangled spokes/hubs,
     and the standard is real stock photos, never AI lookalikes. */
  return 'img/bike-'+b.id+'.png?v='+IMGV;
}

function totals(){
  var b = bike(), t = { price:b.price, weight:b.weight, kw:b.kw, tbd:b.price==null };
  var pt = powertrain();
  t.kw = pt.sysKw;
  CATEGORIES.forEach(function(c){
    var o = catOption(c);
    if(fitLevel(o, b.id)==='no') return;
    var p = optPrice(o);
    if(p) t.price = (t.price==null ? p : t.price + p);
    if(o.dw!=null && t.weight!=null) t.weight = Math.round((t.weight+o.dw)*10)/10;
  });
  t.hp = t.kw * HP_PER_KW;
  return t;
}

/* ---------- powertrain pairing + bottleneck ---------- */
/* ceiling for one powertrain component: rated kW, or the bike's stock kW when
   the stock option is selected, or null when unrated (never fabricate) */
function ptComp(catId, kwField, estField, label){
  var cat = catById(catId); if(!cat) return null;
  var idx = state.sel[catId]||0;
  var o = cat.options[idx]||cat.options[0];
  var b = bike();
  var kw = o[kwField];
  return {
    label: label, optName: o.name,
    kw: (kw!=null) ? kw : (idx===0 ? b.kw : null),
    est: !!o[estField], rated: kw!=null,
    upgraded: idx!==0
  };
}
function powertrain(){
  var b = bike();
  var parts = [
    ptComp('batteries','battMaxKw','battMaxKwEst','Battery'),
    ptComp('controller','ctrlMaxKw',null,'Controller'),
    ptComp('motor','motorPeakKw',null,'Motor')
  ].filter(Boolean);
  var known = parts.filter(function(p){ return p.kw!=null; });
  var sysKw = known.length ? Math.min.apply(null, known.map(function(p){ return p.kw; })) : b.kw;
  var bottleneck = null;
  if(known.length > 1){
    var lo = Math.min.apply(null, known.map(function(p){ return p.kw; }));
    var hi = Math.max.apply(null, known.map(function(p){ return p.kw; }));
    if(hi > lo) bottleneck = known.filter(function(p){ return p.kw===lo; })[0];
  }
  return { parts: parts, sysKw: sysKw, bottleneck: bottleneck };
}
/* rough gas-bike power comparison for a given hp figure */
function gasEquiv(hp){
  if(hp==null || isNaN(hp)) return '';
  if(hp < 6)  return '≈ 50cc pit bike';
  if(hp < 11) return '≈ 125cc trail bike';
  if(hp < 17) return '≈ 150cc trail bike';
  if(hp < 26) return '≈ 250cc trail bike';
  if(hp < 36) return '≈ 125 2-stroke MX';
  if(hp < 48) return '≈ 250F motocross';
  if(hp < 68) return '≈ 450 motocross';
  return '≈ built 450+';
}
function kwFmt(k){ return (Math.round(k*10)/10)+' kW'; }
function renderPtrain(){
  var pt = powertrain(), chain = $('ptChain'), note = $('ptNote');
  chain.innerHTML = ''; note.innerHTML = '';
  pt.parts.forEach(function(p, i){
    if(i){ var ar = document.createElement('span'); ar.className='pt-arrow'; ar.textContent='→'; chain.appendChild(ar); }
    var d = document.createElement('div');
    d.className = 'pt-part' + (pt.bottleneck===p ? ' bottle' : '');
    var l = document.createElement('span'); l.className='pt-l'; l.textContent = p.label; d.appendChild(l);
    var v = document.createElement('strong');
    v.textContent = p.kw!=null ? kwFmt(p.kw)+(p.est?'*':'') : 'unrated';
    d.appendChild(v);
    var n = document.createElement('span'); n.className='pt-n';
    n.textContent = p.upgraded ? p.optName : 'stock';
    n.title = p.optName;
    d.appendChild(n);
    if(pt.bottleneck===p){
      var bg = document.createElement('span'); bg.className='pt-bg'; bg.textContent='bottleneck'; d.appendChild(bg);
    }
    chain.appendChild(d);
  });
  var bn = pt.bottleneck;
  if(bn){
    var others = pt.parts.filter(function(p){ return p!==bn && p.kw!=null; });
    var hi = others.length ? Math.max.apply(null, others.map(function(p){ return p.kw; })) : null;
    var t = 'Bottleneck: your '+bn.label.toLowerCase()+' ('+bn.optName+') caps output at '+kwFmt(bn.kw)+
      (hi!=null ? ' — the rest of the powertrain could deliver up to '+kwFmt(hi) : '') + '.';
    if(bn.label==='Battery'){
      var recs = batteryRecs(pt.sysKw);
      if(recs.length) t += ' Better pairings: '+recs.join(', ')+'.';
    }
    note.textContent = t;
    note.className = 'pt-note warn';
  } else {
    var unrated = pt.parts.filter(function(p){ return !p.rated && p.upgraded; });
    note.textContent = unrated.length
      ? 'Powertrain looks balanced on rated parts. ('+unrated.map(function(p){return p.label;}).join(', ')+' unrated — output unknown.)'
      : 'Powertrain is balanced — no single part is holding the others back.';
    note.className = 'pt-note';
  }
  var est = pt.parts.some(function(p){ return p.est; });
  if(est){
    var e = document.createElement('div'); e.className='pt-est';
    e.textContent = '*estimated from the vendor\u2019s amp rating';
    note.appendChild(e);
  }
}
/* batteries (fitting this bike) whose continuous rating meets or beats demand */
function batteryRecs(demand){
  var b = bike(), cat = catById('batteries');
  if(!cat) return [];
  return cat.options
    .filter(function(o){ return o.battMaxKw!=null && o.battMaxKw >= demand && fitLevel(o, b.id)!=='no'; })
    .sort(function(a,c){ return (best(a)?best(a).p:1e12) - (best(c)?best(c).p:1e12); })
    .slice(0,3)
    .map(function(o){ return o.badge || o.name; });
}

/* ---------- bike size filter chips (lightweight / mid-size / full-size) ---------- */
var SIZE_LABEL = { light:'Lightweight', mid:'Mid-size', full:'Full-size' };
function sizeClassName(b){
  if(b.size==='light') return 'Lightweight · under 150 lb';
  if(b.size==='mid') return 'Mid-size · 150–200 lb';
  if(b.size==='full') return 'Full-size · over 200 lb';
  return 'Size unlisted';
}
function initSizeChips(containerId){
  var host = $(containerId);
  if(!host) return;
  if(!window.__bikeSizeFilter) window.__bikeSizeFilter = 'all';
  var defs = [['all','All bikes'],['light','Lightweight'],['mid','Mid-size'],['full','Full-size']];
  function render(){
    host.innerHTML = '';
    defs.forEach(function(d){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sizechip' + (window.__bikeSizeFilter===d[0] ? ' on' : '');
      b.textContent = d[1];
      b.setAttribute('aria-pressed', window.__bikeSizeFilter===d[0] ? 'true' : 'false');
      /* keep focus off the chip so the bike input doesn't blur-close */
      b.addEventListener('mousedown', function(e){ e.preventDefault(); });
      b.addEventListener('click', function(e){
        e.stopPropagation(); /* keep the document click-closer from shutting the list we just opened */
        window.__bikeSizeFilter = d[0];
        document.querySelectorAll('.sizechips').forEach(function(h){
          h.querySelectorAll('.sizechip').forEach(function(c){
            var on = c.textContent===d[1];
            c.classList.toggle('on', on);
            c.setAttribute('aria-pressed', on?'true':'false');
          });
        });
        /* open the matching bike picker, filtered to this size */
        var map = {startSizeChips:'startBikeInput', builderSizeChips:'bikeSelectInput'};
        var inp = document.getElementById(map[containerId]);
        if(inp){
          inp.value = '';
          if(inp._renderItems) inp._renderItems(true);
        } else {
          document.querySelectorAll('.combo-list').forEach(function(l){ l.hidden = true; });
        }
      });
      host.appendChild(b);
    });
  }
  render();
}

/* ---------- searchable bike picker ---------- */
function syncBikeInputs(){
  var b = bike();
  ['startBikeInput','bikeSelectInput'].forEach(function(id){
    var el = $(id);
    if(el && document.activeElement!==el) el.value = b.name;
  });
}
function initBikePicker(inputId, listId, onPick){
  var input = $(inputId), list = $(listId);
  function close(){ list.hidden = true; }
  function renderItems(showAll){
    var q = showAll ? '' : input.value.trim().toLowerCase();
    var sf = window.__bikeSizeFilter;
    var matches = BIKES.filter(function(b){
      if(sf && sf!=='all' && b.size!==sf) return false;
      return !q || b.name.toLowerCase().indexOf(q)!==-1;
    });
    list.innerHTML = '';
    if(!matches.length){
      var d = document.createElement('div'); d.className='combo-empty';
      d.textContent = 'No bikes match — try another search.';
      list.appendChild(d);
    } else {
      matches.forEach(function(b){
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'combo-item';
        var n = document.createElement('span'); n.textContent = b.name; btn.appendChild(n);
        var p = document.createElement('span'); p.className = 'combo-price';
        p.textContent = money(b.price); btn.appendChild(p);
        btn.addEventListener('mousedown', function(e){
          e.preventDefault(); onPick(b.id); close(); input.blur();
        });
        list.appendChild(btn);
      });
    }
    list.hidden = false;
  }
  input._renderItems = renderItems; /* lets size chips open the filtered list */
  input.addEventListener('input', renderItems);
  input.addEventListener('focus', function(){ input.select(); renderItems(true); });  input.addEventListener('blur', function(){
    setTimeout(function(){ close(); syncBikeInputs(); }, 150);
  });
  input.addEventListener('keydown', function(e){
    if(e.key==='Enter'){
      var q = input.value.trim().toLowerCase();
      var m = BIKES.filter(function(b){ return b.name.toLowerCase().indexOf(q)!==-1; });
      if(m.length) onPick(m[0].id);
      close(); input.blur();
    } else if(e.key==='Escape'){ close(); input.blur(); }
  });
  document.addEventListener('click', function(e){
    var box = input.closest('.combobox');
    if(box && !box.contains(e.target)) close();
  });
}
function bikeSrcText(b){
  if(b.src==='charged') return 'Bike price via Charged Cycle Works';
  if(b.src==='msrp') return 'Bike price: MSRP';
  return 'Coming soon — price TBD';
}

/* ---------- wizard: one part at a time ---------- */
/* ---------- custom dropdown with hover image previews ---------- */
var HOVER_OK = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;
var pprev = null, pprevTimer = null;
function pprevEl(){
  if(!pprev){
    pprev = document.createElement('div');
    pprev.id = 'pprev'; pprev.hidden = true;
    document.body.appendChild(pprev);
  }
  return pprev;
}
function hidePprev(){ if(pprevTimer){ clearTimeout(pprevTimer); pprevTimer = null; } if(pprev) pprev.hidden = true; }
function showPprev(o, anchor){
  if(!o.img){ hidePprev(); return; }
  var el = pprevEl(), bb = best(o);
  el.innerHTML = '';
  var im = document.createElement('img'); im.src = o.img; im.alt = o.name;
  el.appendChild(im);
  var nm = document.createElement('div'); nm.className = 'pp-n'; nm.textContent = o.name; el.appendChild(nm);
  var mt = document.createElement('div'); mt.className = 'pp-m';
  mt.textContent = (bb ? money(bb.p)+' · '+bb.v : 'Included');
  el.appendChild(mt);
  el.hidden = false;
  var r = anchor.getBoundingClientRect(), w = 300, h = el.offsetHeight || 340;
  var x = r.right + 12;
  if(x + w > window.innerWidth - 8) x = Math.max(8, r.left - w - 12);
  var y = Math.max(8, Math.min(r.top - 40, window.innerHeight - h - 8));
  el.style.left = x+'px'; el.style.top = y+'px';
}
function armPreview(row, o){
  if(!HOVER_OK || !o.img) return;
  row.addEventListener('mouseenter', function(){
    if(pprevTimer) clearTimeout(pprevTimer);
    pprevTimer = setTimeout(function(){ showPprev(o, row); }, 140);
  });
  row.addEventListener('mouseleave', hidePprev);
}
function optMeta(o, fl){
  var bp = best(o), parts = [];
  parts.push(bp ? money(bp.p) : 'Included');
  if(o.wtKg!=null) parts.push((o.wtKg*2.20462).toFixed(1)+' lb');
  if(o.battKwh!=null) parts.push(o.battKwh.toFixed(2)+' kWh');
  if(o.battPeakKw!=null) parts.push(o.battPeakKw+' kW peak');
  if(fl==='likely') parts.push('verify fit');
  return parts.join(' · ');
}
/* battery class: long range (>=4.5 kWh) vs high output (>=40 kW peak). A pack can be both. */
function battClass(o){
  var out = [];
  if(o.battKwh!=null && o.battKwh >= 4.5) out.push('long-range');
  if(o.battPeakKw!=null && o.battPeakKw >= 40) out.push('high-output');
  return out;
}
function renderPick(c, b, host){
    var wrap = document.createElement('div'); wrap.className='ppick';
    var vis = [];
    c.options.forEach(function(o,i){
      if(fitLevel(o, b.id)==='no') return; /* don't show parts that don't fit, at all */
      vis.push({o:o, i:i, fl:fitLevel(o, b.id)});
    });
    var cur = state.sel[c.id]||0;
    if(!c.options[cur] || fitLevel(c.options[cur], b.id)==='no'){
      cur = 0;
      while(cur < c.options.length && fitLevel(c.options[cur], b.id)==='no') cur++;
      if(cur >= c.options.length || !vis.length) cur = 0;
      state.sel[c.id]=cur;
    }
    function pick(i){ state.sel[c.id]=i; hidePprev(); render(); saveHash(); }

    if(!vis.length){
      var nd = document.createElement('div'); nd.className='dd-btn'; nd.setAttribute('aria-disabled','true');
      nd.textContent = 'No parts listed for this bike yet';
      wrap.appendChild(nd);
    } else {
      var dd = document.createElement('div'); dd.className='dd';
      var btn = document.createElement('button'); btn.type='button'; btn.className='dd-btn';
      btn.setAttribute('aria-haspopup','listbox'); btn.setAttribute('aria-expanded','false');
      var list = document.createElement('div'); list.className='dd-list'; list.hidden=true; list.setAttribute('role','listbox');
      function syncBtn(){
        var co = c.options[state.sel[c.id]]||c.options[0], bb = best(co);
        btn.innerHTML='';
        if(co.img){ var t=document.createElement('img'); t.className='dd-thumb'; t.src=co.img; t.alt=''; btn.appendChild(t); }
        var tx=document.createElement('span'); tx.className='dd-cur';
        tx.textContent = co.name+' · '+(bb?money(bb.p):'Included');
        btn.appendChild(tx);
        var ch=document.createElement('span'); ch.className='chev'; ch.textContent='▾'; btn.appendChild(ch);
      }
      function close(){ list.hidden=true; btn.setAttribute('aria-expanded','false'); hidePprev(); }
      vis.forEach(function(v){
        var r = document.createElement('button'); r.type='button'; r.className='dd-opt'+(v.i===cur?' sel':'');
        r.setAttribute('role','option'); r.setAttribute('aria-selected', v.i===cur?'true':'false');
        if(v.o.img){ var t=document.createElement('img'); t.className='dd-thumb'; t.src=v.o.img; t.alt=''; t.loading='lazy'; r.appendChild(t); }
        var tx=document.createElement('span');
        var nm=document.createElement('span'); nm.textContent=v.o.name; tx.appendChild(nm);
        var mt=document.createElement('span'); mt.className='meta'; mt.textContent=optMeta(v.o, v.fl); tx.appendChild(mt);
        battClass(v.o).forEach(function(cls){
          var bdg=document.createElement('span'); bdg.className='battbadge '+cls;
          bdg.textContent = cls==='long-range' ? 'Long range' : 'High output';
          tx.appendChild(bdg);
        });
        r.appendChild(tx);
        var pr=document.createElement('span'); pr.className='pr';
        var bb=best(v.o); pr.textContent = bb?money(bb.p):'Incl.';
        r.appendChild(pr);
        r.addEventListener('click', function(){ syncBtn(); pick(v.i); });
        armPreview(r, v.o);
        list.appendChild(r);
      });
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var open = list.hidden;
        document.querySelectorAll('.dd-list').forEach(function(l){ l.hidden=true; });
        document.querySelectorAll('.dd-btn').forEach(function(x){ x.setAttribute('aria-expanded','false'); });
        list.hidden = !open; btn.setAttribute('aria-expanded', String(open));
        if(!open) hidePprev();
      });
      document.addEventListener('keydown', function h(e){ if(e.key==='Escape') close(); });
      syncBtn();
      dd.appendChild(btn); dd.appendChild(list); wrap.appendChild(dd);
    }

    if(vis.length){
    var co = catOption(c), bb = best(co);
    var row = document.createElement('div'); row.className='prow';
    var pl = document.createElement('div'); pl.className='pprice';
    pl.appendChild(document.createTextNode(bb ? money(bb.p) : 'Included'));
    if(bb && co.prices.length>1){
      var tag = document.createElement('span'); tag.className='besttag'; tag.textContent='best price';
      pl.appendChild(tag);
    }
    if(co.tier){
      var tt = document.createElement('span'); tt.className='tier'; tt.textContent=co.tier;
      pl.appendChild(tt);
    }
    if(co.wtKg!=null){
      var ws = document.createElement('span'); ws.className='tier';
      ws.textContent = 'part: '+(co.wtKg*2.20462).toFixed(1)+' lb';
      pl.appendChild(ws);
    }
    if(co.stock){
      var sb = document.createElement('span'); sb.className='tier stock-'+co.stock.replace(/_/g,'-');
      sb.textContent = co.stock.replace(/_/g,' ');
      pl.appendChild(sb);
    }
    row.appendChild(pl);
    if(bb && bb.url){
      var a = document.createElement('a'); a.className='buy'; a.href=bb.url;
      a.target='_blank'; a.rel='noopener'; a.textContent='Buy this part';
      row.appendChild(a);
    }
    wrap.appendChild(row);
    /* fitment explainer: status + why (skip the stock baseline option) */
    if(state.sel[c.id] && co.pid){
      (function(){
        var fr = checkFit(b.id, co);
        var fl = document.createElement('div'); fl.className='fitline fit-'+fr.status;
        var badge = document.createElement('span'); badge.className='fitbadge';
        badge.textContent = FIT_ICON[fr.status]+' '+FIT_LABEL[fr.status];
        fl.appendChild(badge);
        var why = document.createElement('button'); why.type='button'; why.className='fitwhy';
        why.textContent='Why?';
        var det = document.createElement('div'); det.className='fitdetail'; det.hidden=true;
        fr.reasons.forEach(function(rn){
          var p=document.createElement('p'); p.textContent=rn; det.appendChild(p);
        });
        if(fr.evidence && fr.evidence.length){
          var ul=document.createElement('ul');
          fr.evidence.forEach(function(u){
            var li=document.createElement('li'); var ea=document.createElement('a');
            ea.href=u; ea.target='_blank'; ea.rel='noopener';
            try{ ea.textContent=new URL(u).hostname; }catch(e){ ea.textContent=u; }
            li.appendChild(ea); ul.appendChild(li);
          });
          det.appendChild(ul);
        }
        var ck=document.createElement('p'); ck.className='fitchecked';
        ck.textContent='Catalog checked '+fr.checked+'. Fitment is a research snapshot, not live inventory.';
        det.appendChild(ck);
        why.addEventListener('click', function(e){ e.stopPropagation(); det.hidden=!det.hidden; });
        fl.appendChild(why); fl.appendChild(det);
        wrap.appendChild(fl);
      })();
    }
    if(bb && co.prices.length>1){
      var alts = document.createElement('div'); alts.className='alts';
      alts.textContent = 'Also: '+co.prices.filter(function(p){return p!==bb;})
        .map(function(p){return p.v+' '+money(p.p);}).join(' · ')+' — checked '+CHECKED;
      wrap.appendChild(alts);
    }
    } /* end if(shown) */
    host.appendChild(wrap);
}
function buildListEl(){
  var b = bike(), t = totals();
  var list = document.createElement('div'); list.className='build-list';
  function row(cat, name, price, url, vendor){
    var r = document.createElement('div'); r.className='brow';
    var l = document.createElement('div');
    if(cat){ var cs=document.createElement('span'); cs.className='c'; cs.textContent=cat; l.appendChild(cs); }
    var n = document.createElement('span'); n.className='n'; n.textContent=name; l.appendChild(n);
    var pr = document.createElement('div');
    var ps = document.createElement('span'); ps.className='p'; ps.textContent=money(price); pr.appendChild(ps);
    if(url){ pr.appendChild(document.createTextNode(' '));
      var a=document.createElement('a'); a.className='rb'; a.href=url; a.target='_blank'; a.rel='noopener sponsored';
      a.textContent=vendor ? ('Buy at '+vendor) : 'Buy'; pr.appendChild(a); }
    r.appendChild(l); r.appendChild(pr); list.appendChild(r);
  }
  row('', b.name, b.price, '');
  CATEGORIES.forEach(function(c){
    var idx = state.sel[c.id]||0;
    if(idx!==0){ var o=catOption(c), bb=best(o); row(c.name, o.name, bb?bb.p:0, bb?bb.url:'', bb?bb.v:''); }
  });
  var tr = document.createElement('div'); tr.className='brow total';
  tr.innerHTML='<div><span class="n">Total</span></div><div><span class="p">'+(t.tbd?'TBD':money(t.price))+'</span></div>';
  list.appendChild(tr);
  return list;
}
function renderStep(){
  if(state.step > totalSteps()-1) state.step = totalSteps()-1;
  if(state.step < 0) state.step = 0;
  var host = $('stepBody'); host.innerHTML='';
  var b = bike(), n = GROUPS.length;
  if(state.step < n){
    var g = GROUPS[state.step];
    g.cats.forEach(function(cid){
      var c = catById(cid); if(!c) return;
      var sec = document.createElement('div'); sec.className='csec';
      var head = document.createElement('div'); head.className='chead';
      var nm = document.createElement('div'); nm.className='cname'; nm.textContent = c.name; head.appendChild(nm);
      if(c.blurb){ var bl = document.createElement('div'); bl.className='cblurb'; bl.textContent = c.blurb; head.appendChild(bl); }
      if(c.tips && c.tips.length){
        var ul = document.createElement('ul'); ul.className='ctips';
        c.tips.forEach(function(t){ var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
        head.appendChild(ul);
      }
      sec.appendChild(head);
      renderPick(c, b, sec);
      host.appendChild(sec);
    });
    $('stepLabel').innerHTML = '<span class="stepnum">STEP '+(state.step+1)+' / '+totalSteps()+'</span> '+g.name;
    $('btnNext').textContent = (state.step===n-1) ? 'Review build' : 'Next';
    $('btnNext').style.display = '';
    $('btnBack').disabled = (state.step===0);
  } else {
    var rb = buyBikeEl(b.id, b.name);
    if(rb){ rb.classList.add('review-buy'); host.appendChild(rb); }
    else { var nb=document.createElement('p'); nb.className='qnote'; nb.textContent='No verified buy link for the '+b.name+' yet.'; host.appendChild(nb); }
    host.appendChild(buildListEl());
    var acts = document.createElement('div'); acts.className='actions';
    [['Reset', doReset], ['Copy', doCopy], ['Share', doShare], ['Export', doExport]].forEach(function(x){
      var btn = document.createElement('button'); btn.className='link'; btn.textContent=x[0];
      btn.addEventListener('click', x[1]); acts.appendChild(btn);
    });
    host.appendChild(acts);
    $('stepLabel').textContent = 'Review your build';
    $('btnNext').style.display = 'none';
    $('btnBack').disabled = false;
  }
  $('stepFill').style.width = ((state.step+1)/totalSteps()*100)+'%';
}

/* ---------- main render ---------- */
function render(){
  hidePprev();
  var b = bike(), t;
  CATEGORIES.forEach(function(c){
    var i = state.sel[c.id]||0;
    if(fitLevel(c.options[i], b.id)==='no') state.sel[c.id]=0;
  });
  t = totals();
  syncBikeInputs();
  $('bikeSrc').textContent = bikeSrcText(b);

  var img = $('bikeImg'), src = previewSrc();
  if(img.getAttribute('src')!==src) img.src = src;
  img.alt = b.name + ' e-moto';
  var bbx = $('bikeBuy'); if(bbx){ bbx.innerHTML=''; var be = buyBikeEl(b.id, b.name); if(be) bbx.appendChild(be); }

  var badges = $('badges'); badges.innerHTML='';
  CATEGORIES.forEach(function(c){
    var idx = state.sel[c.id]||0;
    if(idx!==0){
      var o = catOption(c);
      var d = document.createElement('span'); d.className='badge';
      var cat = document.createElement('span'); cat.className='cat'; cat.textContent=c.name;
      d.appendChild(cat); d.appendChild(document.createTextNode(o.badge||o.name));
      badges.appendChild(d);
    }
  });

  $('mTotal').textContent = t.tbd ? 'TBD' : money(t.price);
  $('mWeight').textContent = t.weight!=null ? (''+t.weight+' lb') : '–';
  $('mKw').textContent = (''+t.kw+' kW');
  $('mHp').textContent = (''+Math.round(t.hp)+' hp');
  $('mGasEq').textContent = gasEquiv(t.hp);
  renderPtrain();

  renderStep();
  /* real catalog-checked date; if the data has none, drop the dangling "checked" */
  var cd = $('checkedDate'), cw = $('checkedWrap');
  if(typeof CHECKED!=='undefined' && CHECKED){ if(cd) cd.textContent = CHECKED; }
  else if(cw){ cw.style.display = 'none'; }
}

/* ---------- builds tab ---------- */
function guideParts(list){
  return list.map(function(p){
    var c = catById(p.cat), o = c.options[p.opt], bb = best(o);
    return {name:o.name, price:bb?bb.p:0, url:bb?bb.url:'', v:bb?bb.v:''};
  });
}
function buildTotal(bikeId, parts, extras){
  var b = bikeById(bikeId), t = b.price||0;
  parts.forEach(function(p){ t += p.price||0; });
  (extras||[]).forEach(function(e){ t += e.price||0; });
  return (bikeById(bikeId).price==null) ? null : t;
}
function copyBuild(bikeId, parts){
  state.bike = bikeId; state.sel = {}; state.step = 0;
  parts.forEach(function(p){ state.sel[p.cat]=p.opt; });
  showTab('builder'); render(); saveHash();
  toast('Build loaded into the builder.');
}
/* public hook for the quiz (quiz.js): open the builder with a bike
   selected and NO parts selected */
window.openBikeInBuilder = function(bikeId){
  if(!bikeById(bikeId)) return;
  $('start').hidden = true; $('app').hidden = false;
  state.bike = bikeId; state.sel = {}; state.step = 0;
  showTab('builder'); render(); saveHash(); window.scrollTo(0,0);
  toast('Bike loaded — pick your parts.');
};
function partCard(opts){
  var host = opts.host, b = bikeById(opts.bikeId);
  var card = document.createElement('div'); card.className='card';
  var img = document.createElement('img'); img.src=opts.img; img.alt=b.name+' electric dirt bike'; img.loading='lazy';
  card.appendChild(img);
  var body = document.createElement('div'); body.className='body';
  var own = document.createElement('div'); own.className='owner'; own.textContent=opts.kicker;
  body.appendChild(own);
  var h = document.createElement('h3'); h.textContent=opts.title; body.appendChild(h);
  if(opts.blurb){ var bl=document.createElement('p'); bl.className='blurb'; bl.textContent=opts.blurb; body.appendChild(bl); }
  var ul = document.createElement('ul');
  var parts = guideParts(opts.parts);
  parts.forEach(function(p){
    var li=document.createElement('li');
    var n=document.createElement('span'); n.textContent=p.name;
    var pr=document.createElement('span'); pr.textContent=money(p.price);
    if(p.url){ var pa=document.createElement('a'); pa.className='rb'; pa.href=p.url; pa.target='_blank'; pa.rel='noopener sponsored';
      pa.textContent=p.v?('Buy at '+p.v):'Buy'; pr.appendChild(document.createTextNode(' ')); pr.appendChild(pa); }
    li.appendChild(n); li.appendChild(pr); ul.appendChild(li);
  });
  (opts.extras||[]).forEach(function(e){
    var li=document.createElement('li');
    var n=document.createElement('span'); n.textContent=e.name+' (not in catalog)';
    var pr=document.createElement('span'); pr.textContent=money(e.price);
    li.appendChild(n); li.appendChild(pr); ul.appendChild(li);
  });
  var gbb = buyBikeEl(opts.bikeId, b.name, true); if(gbb) body.appendChild(gbb);
  body.appendChild(ul);
  var gt=document.createElement('div'); gt.className='gtotal';
  var gl=document.createElement('span'); gl.textContent='Total';
  var gv=document.createElement('span');
  var tot=buildTotal(opts.bikeId, parts, opts.extras);
  gv.textContent = tot==null ? 'TBD' : money(tot);
  gt.appendChild(gl); gt.appendChild(gv); body.appendChild(gt);
  var btn=document.createElement('button'); btn.className='copybtn'; btn.textContent='Copy this build';
  btn.addEventListener('click', function(){ copyBuild(opts.bikeId, opts.parts); });
  body.appendChild(btn);
  card.appendChild(body); host.appendChild(card);
}
function renderBuilds(){
  /* guide bike picker: one bike at a time, three tier options */
  var gb = $('guideBikes'); gb.innerHTML='';
  var bikes = [];
  GUIDES.forEach(function(gd){ if(bikes.indexOf(gd.bike)<0) bikes.push(gd.bike); });
  if(!state.guideBike || bikes.indexOf(state.guideBike)<0) state.guideBike = bikes[0];
  bikes.forEach(function(bid){
    var b = bikeById(bid);
    var btn = document.createElement('button');
    btn.className = 'gbike' + (bid===state.guideBike ? ' on' : '');
    var im = document.createElement('img'); im.src='img/bike-'+bid+'.png?v='+IMGV; im.alt=b.name+' electric dirt bike'; im.loading='lazy';
    var nm = document.createElement('span'); nm.textContent=b.name;
    btn.appendChild(im); btn.appendChild(nm);
    btn.addEventListener('click', function(){ state.guideBike=bid; renderBuilds(); });
    gb.appendChild(btn);
  });
  var g = $('buildGuides'); g.innerHTML='';
  var s2 = document.createElement('div');
  s2.className = 'gstep';
  s2.innerHTML = '<span class="gnum">2</span> Pick one of the 3 options for the '+bikeById(state.guideBike).name;
  g.appendChild(s2);
  var n = 0;
  GUIDES.forEach(function(gd){
    if(gd.bike!==state.guideBike) return;
    n++;
    var b = bikeById(gd.bike);
    partCard({host:g, kicker:'Option '+n+' · '+b.name, title:gd.name, blurb:gd.blurb,
      img:'img/bike-'+gd.bike+'.png?v='+IMGV, parts:gd.parts, bikeId:gd.bike});
  });
}

/* ---------- tabs / start ---------- */
function showTab(which){
  $('tabBuilder').classList.toggle('on', which==='builder');
  $('tabBuilds').classList.toggle('on', which==='builds');
  $('tabUpcoming').classList.toggle('on', which==='upcoming');
  var tu = $('tabUsed'); if(tu) tu.classList.toggle('on', which==='used');
  var tq = $('tabQuiz'); if(tq) tq.classList.toggle('on', which==='quiz');
  var tc = $('tabCompare'); if(tc) tc.classList.toggle('on', which==='compare');
  $('builderPane').hidden = which!=='builder';
  $('buildsPane').hidden = which!=='builds';
  $('upcomingPane').hidden = which!=='upcoming';
  var qp = $('quizPane'); if(qp) qp.hidden = which!=='quiz';
  var cp = $('comparePane'); if(cp) cp.hidden = which!=='compare';
  var up = $('usedPane'); if(up) up.hidden = which!=='used';
  if(which==='builds') renderBuilds();
  if(which==='upcoming') renderUpcoming();
  if(which==='used' && typeof renderUsed==='function') renderUsed();
}
$('tabBuilder').addEventListener('click', function(){ showTab('builder'); });
$('tabBuilds').addEventListener('click', function(){ showTab('builds'); });
$('tabUpcoming').addEventListener('click', function(){ showTab('upcoming'); });
var tabQuizEl = $('tabQuiz'); if(tabQuizEl) tabQuizEl.addEventListener('click', function(){ if(window.__quiz && window.__quiz.startQuiz) window.__quiz.startQuiz(); });
var tabCompareEl = $('tabCompare'); if(tabCompareEl) tabCompareEl.addEventListener('click', function(){ showTab('compare'); if(window.__compare && window.__compare.renderCompare) window.__compare.renderCompare(); });
var tabUsedEl = $('tabUsed'); if(tabUsedEl) tabUsedEl.addEventListener('click', function(){ showTab('used'); });

/* ---------- upcoming bikes ---------- */
var STATUS_LABEL = {'shipping':'Shipping now','preorder':'Pre-order','announced':'Announced','rumored':'Rumored'};
function renderUpcoming(){
  var host = $('upcomingList'); host.innerHTML='';
  UPCOMING.forEach(function(u){
    if(u.status==='shipping') return; /* released bikes don't belong in Upcoming */
    var card = document.createElement('div'); card.className='card';
    var img = document.createElement('img');
    img.src = u.bikeId ? 'img/bike-'+u.bikeId+'.png?v='+IMGV : 'img/bike-lightbee.png?v='+IMGV;
    img.alt = u.name + ' e-moto'; img.loading='lazy';
    card.appendChild(img);
    var body = document.createElement('div'); body.className='body';
    var top = document.createElement('div'); top.className='urow';
    var h = document.createElement('h3'); h.textContent = u.name; top.appendChild(h);
    var st = document.createElement('span'); st.className='ustatus '+u.status; st.textContent = STATUS_LABEL[u.status]||u.status;
    top.appendChild(st); body.appendChild(top);
    if(u.date){ var d = document.createElement('div'); d.className='udate'; d.textContent = u.date; body.appendChild(d); }
    if(u.blurb){ var bl = document.createElement('p'); bl.className='blurb'; bl.textContent = u.blurb; body.appendChild(bl); }
    var meta = document.createElement('div'); meta.className='umeta';
    if(u.price){ var pr = document.createElement('span'); pr.textContent = money(u.price)+' MSRP'; meta.appendChild(pr); }
    if(u.source){ var a = document.createElement('a'); a.href=u.source; a.target='_blank'; a.rel='noopener'; a.textContent='Source'; meta.appendChild(a); }
    body.appendChild(meta);
    if(u.bikeId && bikeById(u.bikeId)){
      var btn = document.createElement('button'); btn.className='copybtn'; btn.textContent='Build it';
      (function(bid){ btn.addEventListener('click', function(){
        state.bike = bid; state.sel = {}; state.step = 0;
        showTab('builder'); render(); saveHash();
      }); })(u.bikeId);
      body.appendChild(btn);
    }
    card.appendChild(body); host.appendChild(card);
  });
  $('upcomingNote').textContent = 'Release dates change — checked '+UPCOMING_CHECKED+'.';
}

/* ---------- submit-your-part modal ---------- */
var SUBMIT_EMAIL = 'ebikepartspicker@gmail.com'; /* inbox for vendor part submissions */
var IMGV = '3.10.7'; /* bump when bike images change so browsers refetch */
(function(){
  var overlay = $('suggestOverlay');
  if(!overlay) return;
  var catSel = $('sgCat');
  CATEGORIES.forEach(function(c){
    var o = document.createElement('option'); o.value = c.name; o.textContent = c.name;
    catSel.appendChild(o);
  });
  /* populate bike multi-select with real bikes */
  var bikeSel = $('sgBikes');
  if(bikeSel && typeof BIKES!=='undefined'){
    BIKES.forEach(function(b){
      var o = document.createElement('option'); o.value = b.name; o.textContent = b.name;
      bikeSel.appendChild(o);
    });
  }
  function open(){ overlay.hidden = false; document.body.style.overflow='hidden'; }
  function close(){ overlay.hidden = true; document.body.style.overflow=''; }
  $('btnSuggest').addEventListener('click', open);
  $('suggestClose').addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !overlay.hidden) close(); });
  function val(id){ return $(id).value.trim(); }
  function selectedBikes(){
    var sel = $('sgBikes');
    if(!sel) return '';
    var out = [];
    for(var i=0; i<sel.options.length; i++){
      if(sel.options[i].selected) out.push(sel.options[i].value);
    }
    return out.join(', ');
  }
  $('sgSubmit').addEventListener('click', function(){
    var err = $('sgErr');
    if(!val('sgName') || !val('sgUrl')){ err.hidden = false; return; }
    err.hidden = true;
    var lines = [
      'Part submission for eBikePartsPicker', '',
      'Brand / company: '+(val('sgBrand')||'—'),
      'Contact email: '+(val('sgEmail')||'—'),
      'Part name: '+val('sgName'),
      'Product URL: '+val('sgUrl'),
      'Price: '+(val('sgPrice')?'$'+val('sgPrice'):'—'),
      'Category: '+(val('sgCat')||'—'),
      'Fits: '+(selectedBikes()||'—'), '',
      'About: '+(val('sgWhy')||'—')
    ];
    var text = lines.join('\n');
    $('sgPreview').textContent = text;
    var subj = 'Part submission: '+val('sgName');
    $('sgMail').href = SUBMIT_EMAIL
      ? 'mailto:'+SUBMIT_EMAIL+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(text)
      : '#';
    $('sgMail').style.display = SUBMIT_EMAIL ? '' : 'none';
    $('suggestForm').hidden = true;
    $('suggestDone').hidden = false;
    $('sgCopy').onclick = function(){
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function(){ toast('Copied — send it our way!'); },
              function(){ toast('Copy failed — select the text manually.'); });
    };
  });
  $('sgAgain').addEventListener('click', function(){
    $('suggestDone').hidden = true;
    $('suggestForm').hidden = false;
    ['sgBrand','sgEmail','sgName','sgUrl','sgPrice','sgWhy'].forEach(function(id){ $(id).value=''; });
    catSel.value = '';
    var bs = $('sgBikes');
    if(bs){ for(var i=0; i<bs.options.length; i++) bs.options[i].selected = false; }
  });
})();

/* ---------- share / export ---------- */
function summary(){
  var b = bike(), t = totals();
  var lines = ['eBikePartsPicker build — '+b.name,
    'Total: '+(t.tbd?'TBD':money(t.price)),
    'Weight: '+(t.weight!=null?t.weight+' lb':'TBD'),
    'Power: '+t.kw+' kW / '+Math.round(t.hp)+' hp',''];
  CATEGORIES.forEach(function(c){
    var idx=state.sel[c.id]||0;
    if(idx!==0) lines.push(c.name+': '+catOption(c).name);
  });
  lines.push('', 'Estimates checked '+CHECKED+' — verify before buying.', 'Build: '+location.href);
  return lines.join('\n');
}
function toast(msg){ var t=$('toast'); t.textContent=msg; t.style.display='block';
  clearTimeout(t._h); t._h=setTimeout(function(){ t.style.display='none'; }, 3200); }
function saveHash(){
  history.replaceState(null,'','#'+encodeURIComponent(JSON.stringify({b:state.bike, s:state.sel})));
}
function loadHash(){
  try{
    if(location.hash){
      var h = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if(h.b && bikeById(h.b)) state.bike = h.b;
      if(h.s) CATEGORIES.forEach(function(c){
        var i = h.s[c.id];
        if(Number.isInteger(i) && i>=0 && i<c.options.length) state.sel[c.id]=i;
      });
    }
  }catch(e){}
}

$('btnStart').addEventListener('click', function(){
  $('start').hidden = true; $('app').hidden = false;
  state.step = 0;
  render(); saveHash(); window.scrollTo(0,0);
});
$('btnBack').addEventListener('click', function(){
  if(state.step>0){ state.step--; render(); window.scrollTo(0,0); }
});
$('btnNext').addEventListener('click', function(){
  if(state.step<totalSteps()-1){ state.step++; render(); window.scrollTo(0,0); }
});
/* Notify-me signup (start page): no backend — opens a prefilled email */
(function(){
  var btn = $('notifyBtn'), inp = $('notifyEmail'), err = $('notifyErr');
  if(!btn || !inp) return;
  function submit(){
    var v = inp.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ if(err) err.hidden = false; return; }
    if(err) err.hidden = true;
    var subj = 'Notify list signup';
    var body = 'Please notify me when new bikes and parts are added.\n\nEmail: '+v;
    location.href = 'mailto:ebikepartspicker@gmail.com?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body);
    toast('Opening your mail app to confirm the signup.');
  }
  btn.addEventListener('click', submit);
  inp.addEventListener('keydown', function(e){ if(e.key==='Enter') submit(); });
})();
/* Share my build: same hash format the builder already saves/restores */
var shb = $('btnShareBuild');
if(shb) shb.addEventListener('click', function(){
  saveHash();
  var url = location.href;
  function done(){ toast('Build link copied — share it anywhere.'); }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(done, function(){ toast('Copy failed — copy the address bar link instead.'); });
  } else {
    toast('Copy this link: '+url);
  }
});
function doReset(){
  CATEGORIES.forEach(function(c){ state.sel[c.id]=0; }); state.step=0; render(); saveHash(); toast('Build reset.');
}
function doCopy(){
  var txt = summary();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ toast('Summary copied.'); }, function(){ toast(txt); });
  } else toast(txt);
}
function doShare(){
  saveHash(); toast('Build saved in this page link. Copy the address to share.');
}
function doExport(){
  var blob = new Blob([summary()],{type:'text/plain'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'ebikepartspicker-build.txt'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}

loadHash();
/* one global handler: clicking outside any open part dropdown closes it */
document.addEventListener('click', function(e){
  if(!e.target.closest || !e.target.closest('.dd')){
    hidePprev();
    document.querySelectorAll('.dd-list').forEach(function(l){ l.hidden = true; });
    document.querySelectorAll('.dd-btn[aria-expanded]').forEach(function(x){ x.setAttribute('aria-expanded','false'); });
  }
});
initBikePicker('startBikeInput', 'startBikeList', function(id){
  state.bike = id; syncBikeInputs();
  var hero = $('heroImg'), b = bikeById(id);
  if(hero && b){ hero.src = 'img/bike-'+b.id+'.png?v='+IMGV; hero.alt = b.name+' electric dirt bike'; }
});
initBikePicker('bikeSelectInput', 'bikeSelectList', function(id){
  state.bike = id; state.step = 0; syncBikeInputs(); render(); saveHash();
});
initSizeChips('startSizeChips');
initSizeChips('builderSizeChips');
syncBikeInputs();
/* start-page live stats: real catalog counts, or hide the row — never dashes */
(function(){
  var row = document.querySelector('.stats');
  try{
    if(typeof BIKES==='undefined' || typeof CATEGORIES==='undefined' || !BIKES.length) throw 0;
    var pc = CATEGORIES.reduce(function(n,c){ return n + Math.max(0, c.options.length-1); }, 0);
    var sb=$('statBikes'), sp=$('statParts'), sc=$('statCats');
    if(sb) sb.textContent = BIKES.length;
    if(sp) sp.textContent = pc;
    if(sc) sc.textContent = CATEGORIES.length;
  }catch(e){
    if(row) row.style.display = 'none';
  }
})();
/* shared build link? skip the start page */
if(location.hash){
  $('start').hidden = true; $('app').hidden = false;
  render(); window.scrollTo(0,0);
}
})();
