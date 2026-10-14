/* eBikePartsPicker — "Which E-Moto Fits Me?" quiz (v3.11.0)
   Standalone module: reads BIKES from data.js, scores every bike with an
   explainable weighted-factor method, and hands the pick to the builder
   through window.openBikeInBuilder (defined in app.js).

   Match % = 100 * sum(factor_score * factor_weight). Every factor returns
   0..1 plus human-readable reasons, so the number is auditable, not a
   black-box confidence score. */
(function(){
"use strict";

/* ---------- small helpers ---------- */
function $(id){ return document.getElementById(id); }
function money(n){ if(n==null) return 'TBD';
  var c=(n%1)?2:0;
  return n.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:c,maximumFractionDigits:c}); }
function bikeById(id){ return (window.BIKES||[]).find(function(b){ return b.id===id; }) || null; }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* Financing is an EXAMPLE only — never a vendor rate or an approval.
   FIN_PARTNERS is the hook where real financing links go later. */
var FIN = { apr: 0.099, termMonths: 36, downPct: 0.10, minPrice: 1500 };
var FIN_PARTNERS = []; /* future: {name, url, note} — shown beside the example, never ranked by commission */
function finMonthly(price){
  var P = price * (1 - FIN.downPct), r = FIN.apr/12, n = FIN.termMonths;
  var m = P * r / (1 - Math.pow(1+r, -n));
  return { monthly: m, financed: P, down: price*FIN.downPct };
}

/* ---------- quiz questions ---------- */
var HEIGHT_OPTS = [], WEIGHT_OPTS = [];
(function(){
  for(var h=48; h<=80; h++) HEIGHT_OPTS.push({v:h, t:Math.floor(h/12)+"'"+(h%12)+'"'});
  for(var w=60; w<=320; w+=5) WEIGHT_OPTS.push({v:w, t:w+' lb'});
})();
var QUESTIONS = [
  { id:'rider', title:"Who's the bike for?",
    sub:'Fit and safety start here — kids and teens get scored for control, not power.',
    type:'single', def:'adult',
    opts:[
      {v:'adult', t:'Adult', d:'18+ riding for themselves'},
      {v:'teen', t:'Teen', d:'13–17'},
      {v:'child', t:'Child', d:'Under 13'},
      {v:'family', t:'Family', d:'Shared between riders'}
    ]},
  { id:'size', title:'How tall is the rider, and roughly how much do they weigh?',
    sub:'Used for bike size and controllability. If family use, answer for the primary rider.',
    type:'hw', def:{h:70, w:175} },
  { id:'dirt', title:'How much dirt bike experience do you have?',
    sub:'Gas or electric — seat time counts either way.',
    type:'single', def:'some',
    opts:[
      {v:'new', t:'New to dirt', d:'Never ridden off-road much'},
      {v:'some', t:'Some riding', d:'Comfortable on easy trails'},
      {v:'experienced', t:'Experienced', d:'Years of trail or track time'},
      {v:'expert', t:'Expert', d:'Race pace, big jumps, no fear'}
    ]},
  { id:'eexp', title:'And e-motos specifically?',
    sub:'E-motos hit different — instant torque, no clutch, no gears.',
    type:'single', def:'new',
    opts:[
      {v:'new', t:'New to e-motos', d:'Never ridden one'},
      {v:'some', t:'Some e-moto time', d:'Rented or borrowed a few times'},
      {v:'experienced', t:'Experienced', d:'Own or regularly ride one'}
    ]},
  { id:'styles', title:'Where will you mostly ride?',
    sub:'Pick all that apply — this shapes the handling and power mix.',
    type:'multi', def:['mixed'],
    opts:[
      {v:'technical', t:'Technical trails'},
      {v:'singletrack', t:'Singletrack'},
      {v:'desert', t:'Desert / open terrain'},
      {v:'motocross', t:'Motocross track'},
      {v:'property', t:'Private property'},
      {v:'paved', t:'Paved / street'},
      {v:'mixed', t:'A bit of everything'}
    ]},
  { id:'budget', title:"What's your bike budget?",
    sub:'Bike price only — parts and gear come later in the builder.',
    type:'single', def:'b4',
    opts:[
      {v:'b0', t:'Under $1,500'},
      {v:'b1', t:'$1,500 – $2,500'},
      {v:'b2', t:'$2,500 – $3,500'},
      {v:'b3', t:'$3,500 – $5,000'},
      {v:'b4', t:'$5,000 – $7,500'},
      {v:'b5', t:'$7,500+'}
    ]},
  { id:'duration', title:'How long are your typical rides?',
    sub:'Real-world range swings a lot with rider weight, terrain, speed, temperature and riding style — treat every range claim as a rough guide.',
    type:'single', def:'medium',
    opts:[
      {v:'short', t:'Under an hour', d:'Quick laps, backyard sessions'},
      {v:'medium', t:'1–2 hours', d:'Typical trail ride'},
      {v:'long', t:'2+ hours', d:'Big days, long loops'}
    ]},
  { id:'power', title:'How do you like your power delivery?',
    sub:'Be honest — the right bike is the one you can actually use.',
    type:'single', def:'balanced',
    opts:[
      {v:'mellow', t:'Mellow & easy', d:'Smooth, predictable, no surprises'},
      {v:'balanced', t:'Balanced', d:'Strong pull without being scary'},
      {v:'aggressive', t:'Aggressive', d:'Maximum hit, I can handle it'}
    ]},
  { id:'handling', title:'Pick your handling style.',
    sub:'Light bikes turn and flick; big bikes stay planted at speed.',
    type:'single', def:'balanced',
    opts:[
      {v:'nimble', t:'Light & nimble', d:'Easy to throw around'},
      {v:'balanced', t:'Balanced', d:'A bit of both'},
      {v:'planted', t:'Big & planted', d:'Stable, full-size feel'}
    ]},
  { id:'priorities', title:'Thinking about upgrades down the road?',
    sub:'Optional — helps us suggest parts after your recommendations. Pick any.',
    type:'multi', optional:true, def:[],
    opts:[
      {v:'suspension', t:'Suspension'},
      {v:'battery', t:'Battery & range'},
      {v:'power', t:'More power'},
      {v:'brakes', t:'Brakes'},
      {v:'comfort', t:'Comfort & ergonomics'}
    ]}
];
var BUDGET_MAX = { b0:1500, b1:2500, b2:3500, b3:5000, b4:7500, b5:Infinity };
var BUDGET_LABEL = { b0:'Under $1,500', b1:'$1,500 – $2,500', b2:'$2,500 – $3,500',
  b3:'$3,500 – $5,000', b4:'$5,000 – $7,500', b5:'$7,500+' };

/* ---------- estimated real-world trail range (miles) ----------
   Owner-reported averages / class-based guesstimates — NOT manufacturer
   claims, NOT verified specs. Always displayed with "est." and never
   presented as a guaranteed figure. null = unknown (scores neutral). */
var QUIZ_RANGE = {
  'ventus-plus':50, 'ventus-evo':50, 'lightbee':35,
  'ultrabee':50, 'ultrabee-21kw':50, 'ultrabee-hd':null,
  'ss20':40, 'ss30':45, 'ss40':45, 'sr':50,
  'mx4':40, 'mx5':40, 'komodo':50,
  'bonnell-805rx':55, 'storm-bee':65, 'stark-vargex':70,
  'arctic-xd':null, 'rerode-rx':45, 'altis-sigma':45,
  'rawrr-mantis-72v':35, 'rawrr-mantis-x-pro':35, 'rawrr-mantis-x':35,
  'falcon-pro':35, 'falcon-gt':40,
  'rtr-lite':25, 'rtr-lite-2-0':25, 'rtr-sport':30,
  'rtr-alpha':40, 'rtr-xl':35, 'rtr-xl-alpha':40,
  'yozma-in10':30, 'yozma-in10-pro':30, 'tuttio-soleil01':22,
  'yvolt-surge-v':55, 'supermach-sm01':45, 'supermach-sm62':45
};
var DURATION_NEED = { short:15, medium:30, long:45 }; /* miles wanted */

/* ---------- scoring factors ----------
   Each returns {s: 0..1, why: [strings], flags: [strings]}.
   Weights below sum to 1.0 and are user-adjustable on the results page. */
var WEIGHTS = { budget:0.25, size:0.18, power:0.18, experience:0.17, style:0.12, range:0.10 };

function riderHW(a){
  var s = (a && a.size) || {};
  return { h: s.h||70, w: s.w||175 };
}
function targetWeight(a){
  var hw = riderHW(a);
  if(a.rider==='child') return 112;
  if(a.rider==='teen') return 138;
  if(hw.w < 140) return 145;
  if(hw.w > 215 || hw.h >= 74) return 195;
  return 165;
}
function fBudget(bike, a){
  var max = BUDGET_MAX[a.budget], why=[], flags=[];
  if(bike.price==null){ flags.push('price-tbd'); why.push('Price not in the catalog yet — budget fit unknown.'); return {s:0.4, why:why, flags:flags}; }
  if(bike.price <= max){ why.push('Priced at '+money(bike.price)+' — inside your '+BUDGET_LABEL[a.budget]+' budget.'); return {s:1, why:why, flags:flags}; }
  if(max===Infinity){ why.push('Priced at '+money(bike.price)+' — premium territory, but your budget is open.'); return {s:0.75, why:why, flags:flags}; }
  if(bike.price <= max*1.15){ flags.push('stretch');
    why.push('Priced at '+money(bike.price)+' — about '+money(bike.price-max)+' over budget (stretch).');
    return {s:0.55, why:why, flags:flags}; }
  flags.push('over-budget');
  why.push('Priced at '+money(bike.price)+' — '+money(bike.price-max)+' over your budget.');
  return {s:0, why:why, flags:flags};
}
function fSize(bike, a){
  var why=[], flags=[], t = targetWeight(a), hw = riderHW(a);
  if(bike.weight==null){ flags.push('weight-unknown');
    why.push('Weight unverified — size fit is a guess until we confirm it.'); return {s:0.5, why:why, flags:flags}; }
  var d = Math.abs(bike.weight - t), s = clamp(1 - d/110, 0, 1);
  if(a.rider==='child'||a.rider==='teen'){
    if(bike.weight <= t+15) why.push('At '+bike.weight+' lb it\u2019s light enough for a younger rider to manage.');
    else why.push('At '+bike.weight+' lb it may be a handful for a younger rider.');
  } else if(bike.weight > t+40){
    why.push('At '+bike.weight+' lb it\u2019s heavier than ideal for a '+hw.w+' lb rider — harder to pick up and muscle around.');
  } else if(bike.weight < t-50){
    why.push('At '+bike.weight+' lb it may feel small under a '+hw.h+'" rider — check the ergonomics in person.');
  } else {
    why.push('At '+bike.weight+' lb the size is a good match for a '+hw.h+'" / '+hw.w+' lb rider.');
  }
  return {s:s, why:why, flags:flags};
}
function powerTarget(pref){ return pref==='mellow'?6 : pref==='aggressive'?28 : 14; }
function fPower(bike, a){
  var why=[], flags=[], t = powerTarget(a.power);
  if(bike.kw==null){ flags.push('power-unknown');
    why.push('Power output unverified — can\u2019t match it to your preference.'); return {s:0.5, why:why, flags:flags}; }
  /* asymmetric: mellow riders are penalized for too MUCH power, aggressive
     riders for too LITTLE. Nobody gets extra credit just for a bigger number. */
  var s;
  if(a.power==='aggressive') s = bike.kw>=t ? 1 : clamp(1-(t-bike.kw)/18, 0, 1);
  else if(a.power==='mellow') s = bike.kw<=t ? 1 : clamp(1-(bike.kw-t)/18, 0, 1);
  else s = clamp(1 - Math.abs(bike.kw - t)/18, 0, 1);
  if(a.power==='mellow' && bike.kw > 18) why.push(bike.kw+' kW is a lot more punch than \u201cmellow\u201d — easy to get in over your head.');
  else if(a.power==='aggressive' && bike.kw < 12) why.push('Only '+bike.kw+' kW — you\u2019ll likely outgrow the power quickly.');
  else if(s > 0.7) why.push(bike.kw+' kW lines up with a '+a.power+' power preference.');
  return {s:s, why:why, flags:flags};
}
function skillLevel(a){
  var map = {new:0, some:1, experienced:2, expert:3};
  var sk = Math.min(map[a.dirt]||0, a.eexp==='experienced'?2:(map[a.eexp]||0));
  if(a.rider==='child') sk = 0;
  if(a.rider==='teen') sk = Math.min(sk, 2);
  return sk;
}
function fExperience(bike, a){
  var why=[], flags=[], sk = skillLevel(a);
  var safeKw = [12, 16, 26, 80][sk];
  if(bike.kw==null){ flags.push('power-unknown'); return {s:0.5, why:['Power unverified — can\u2019t safety-check it for your experience.'], flags:flags}; }
  if(bike.kw <= safeKw){
    why.push('Power level suits your experience — controllable, not overwhelming.');
    return {s:1, why:why, flags:flags};
  }
  var s = clamp(safeKw/bike.kw, 0.12, 0.95);
  flags.push('power-warning');
  var who = a.rider==='child' ? 'a young rider' : a.rider==='teen' ? 'a teen rider' : 'your experience level';
  why.push(bike.kw+' kW is strong for '+who+' — respect the learning curve, start in a low mode.');
  return {s:s, why:why, flags:flags};
}
function styleScoreOne(st, bike){
  var wt = bike.weight, kw = bike.kw;
  switch(st){
    case 'motocross': return clamp((wt!=null&&wt>=160?0.6:0.25) + (kw!=null&&kw>=15?0.4:0.15), 0, 1);
    case 'singletrack':
    case 'technical': return wt==null ? 0.5 : clamp(1-(wt-140)/80, 0.1, 1);
    case 'desert': return kw==null ? 0.5 : clamp(kw/25, 0.15, 1);
    case 'property': return clamp((wt!=null&&wt<=175?0.6:0.3) + (kw!=null&&kw<=22?0.4:0.2), 0, 1);
    case 'paved': return 0.7;
    case 'mixed': return 0.6;
    default: return 0.6;
  }
}
function fStyle(bike, a){
  var styles = a.styles && a.styles.length ? a.styles : ['mixed'];
  var s = styles.reduce(function(n,st){ return n + styleScoreOne(st,bike); }, 0) / styles.length;
  var why = ['Riding mix ('+styles.join(', ')+') '+(s>=0.6?'suits':'is just okay for')+' this bike\u2019s size and power.'];
  return {s:s, why:why, flags:[]};
}
function fRange(bike, a){
  var why=[], flags=[], need = DURATION_NEED[a.duration] || 30;
  var est = QUIZ_RANGE[bike.id];
  if(est==null){ flags.push('range-unknown');
    why.push('No range estimate for this bike yet — can\u2019t match it to your ride length.');
    return {s:0.5, why:why, flags:flags}; }
  var s = clamp(est/need, 0, 1);
  var dur = a.duration==='short' ? 'under-an-hour' : a.duration==='medium' ? '1\u20132 hour' : '2+ hour';
  if(est >= need) why.push('Est. ~'+est+' mi of trail range — covers your '+dur+' rides.');
  else why.push('Est. ~'+est+' mi of range — short for '+dur+' rides; plan shorter loops or a second battery.');
  return {s:s, why:why, flags:flags};
}
var FACTORS = { budget:fBudget, size:fSize, power:fPower, experience:fExperience, style:fStyle, range:fRange };
var FACTOR_LABEL = { budget:'Budget fit', size:'Size & control', power:'Power match', experience:'Experience safety', style:'Riding style', range:'Range fit' };

function scoreBike(bike, a, weights){
  var w = weights || WEIGHTS, total = 0, wsum = 0, detail = {};
  Object.keys(FACTORS).forEach(function(k){
    var r = FACTORS[k](bike, a);
    detail[k] = r;
    total += r.s * (w[k]||0); wsum += (w[k]||0);
  });
  var pct = wsum ? Math.round(total/wsum*100) : 0;
  return { bike:bike, pct:pct, detail:detail };
}
function scoreAll(a, weights){
  return (window.BIKES||[]).map(function(b){ return scoreBike(b, a, weights); })
    .sort(function(x,y){ return y.pct - x.pct; });
}

/* ---------- recommendation picks ---------- */
function pickRecommendations(scored, a){
  var max = BUDGET_MAX[a.budget];
  var inBudget = scored.filter(function(r){ return r.bike.price!=null && r.bike.price<=max; });
  var best = scored[0] || null;
  var value = null;
  var valPool = inBudget.filter(function(r){ return r.pct>=55; });
  if(!valPool.length) valPool = scored.filter(function(r){ return r.pct>=45 && r.bike.price!=null; });
  valPool.forEach(function(r){
    var ratio = r.pct / r.bike.price;
    if(!value || ratio > value.ratio) value = { rec:r, ratio:ratio };
  });
  var perf = null;
  scored.forEach(function(r){
    if(r.pct < 45 || r.bike.kw==null) return;
    if(best && r.bike.id===best.bike.id) return;
    if(!perf || r.bike.kw > perf.bike.kw || (r.bike.kw===perf.bike.kw && r.pct>perf.pct)) perf = r;
  });
  if(!perf) perf = scored.filter(function(r){ return r.bike.kw!=null; })
    .sort(function(x,y){ return y.bike.kw - x.bike.kw; })[0] || best;
  var stretch = null;
  var overPool = scored.filter(function(r){
    return r.bike.price!=null && max!==Infinity && r.bike.price>max &&
           (!best || r.bike.id!==best.bike.id) && r.pct >= (best?best.pct:0)-8;
  });
  if(overPool.length) stretch = overPool[0];
  return { best:best, value:value?value.rec:null, perf:perf, stretch:stretch };
}

/* ---------- upgrade suggestions (compatible, never pre-selected) ---------- */
var UPGRADE_CATS = ['batteries','controller','motor','fork','shock','brakes','seat','handlebar','plastics','wheels','tires','pegs','cockpit'];
function optFitsBike(opt, bike){
  if(!opt.fits || opt.fits==='universal') return 'yes';
  if(opt.fits.indexOf(bike.id)!==-1) return 'yes';
  if(opt.likely && opt.likely.indexOf(bike.id)!==-1) return 'likely';
  if(opt.no && opt.no.indexOf(bike.id)!==-1) return 'no';
  if(bike.sparse) return 'likely';
  return 'no';
}
function bestPrice(opt){
  if(!opt.prices || !opt.prices.length) return null;
  return opt.prices.reduce(function(x,y){ return y.p < x.p ? y : x; }).p;
}
function upgradeSuggestions(bikeId, priorities){
  var bike = bikeById(bikeId); if(!bike) return [];
  var prioCats = { suspension:['fork','shock'], battery:['batteries','charger'],
    power:['motor','controller'], brakes:['brakes'], comfort:['seat','handlebar','pegs','cockpit'] };
  var wanted = [];
  (priorities||[]).forEach(function(p){ (prioCats[p]||[]).forEach(function(c){ if(wanted.indexOf(c)<0) wanted.push(c); }); });
  var cats = wanted.length ? wanted : UPGRADE_CATS;
  var out = [];
  cats.forEach(function(cid){
    var c = (window.CATEGORIES||[]).find(function(x){ return x.id===cid; });
    if(!c) return;
    c.options.forEach(function(o, i){
      if(i===0) return; /* stock baseline */
      var fl = optFitsBike(o, bike);
      if(fl==='no') return;
      var p = bestPrice(o);
      out.push({ cat:c.name, name:o.name, price:p, fit:fl, badge:o.badge||o.name });
    });
  });
  out.sort(function(a,b){ return (a.price==null?1e12:a.price) - (b.price==null?1e12:b.price); });
  return out.slice(0, 6);
}

/* ---------- quiz state + share links ---------- */
var qstate = { step:0, answers:null, results:null, weights:null };
function defaultAnswers(){
  var a = {};
  QUESTIONS.forEach(function(q){
    a[q.id] = q.type==='hw' ? {h:q.def.h, w:q.def.w} : JSON.parse(JSON.stringify(q.def));
  });
  return a;
}
function encodeShare(a, weights){
  try{
    var json = JSON.stringify({a:a, w:weights});
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch(e){ return ''; }
}
function decodeShare(s){
  try{
    var b64 = s.replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length%4) b64 += '=';
    var obj = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if(!obj || !obj.a || typeof obj.a!=='object') return null;
    /* validate against known questions/options */
    var a = {};
    QUESTIONS.forEach(function(q){
      var v = obj.a[q.id];
      if(q.type==='single'){
        var ok = q.opts.some(function(o){ return o.v===v; });
        a[q.id] = ok ? v : q.def;
      } else if(q.type==='multi'){
        a[q.id] = Array.isArray(v) ? v.filter(function(x){ return q.opts.some(function(o){ return o.v===x; }); }) : [];
      } else if(q.type==='hw'){
        a[q.id] = { h:clamp(parseInt(v&&v.h)||70,48,80), w:clamp(parseInt(v&&v.w)||175,60,320) };
      }
    });
    return { answers:a, weights:obj.w||null };
  }catch(e){ return null; }
}

/* ---------- rendering: quiz flow ---------- */
function el(tag, cls, text){
  var d = document.createElement(tag);
  if(cls) d.className = cls;
  if(text!=null) d.textContent = text;
  return d;
}
function renderQuiz(){
  var host = $('quizBody'); host.innerHTML='';
  var wrap = el('div','qwrap');
  if(qstate.step < QUESTIONS.length){ renderQuestion(wrap); }
  else { renderResults(wrap); }
  host.appendChild(wrap);
  window.scrollTo(0,0);
}
function progressBar(wrap, label){
  var bar = el('div','qprog');
  var fill = el('div','qfill'); fill.style.width = label;
  bar.appendChild(fill); wrap.appendChild(bar);
}
function renderQuestion(wrap){
  var q = QUESTIONS[qstate.step], a = qstate.answers;
  progressBar(wrap, ((qstate.step+1)/(QUESTIONS.length+1)*100)+'%');
  wrap.appendChild(el('div','qstep','Question '+(qstate.step+1)+' of '+QUESTIONS.length));
  wrap.appendChild(el('h2','qtitle', q.title));
  if(q.sub) wrap.appendChild(el('p','qsub', q.sub));
  var err = el('div','qerr', 'Pick an answer to continue.'); err.hidden = true; wrap.appendChild(err);

  if(q.type==='hw'){
    var row = el('div','qhw');
    [['h','Height',HEIGHT_OPTS],['w','Weight',WEIGHT_OPTS]].forEach(function(cfg){
      var lab = el('label','qlab', cfg[1]);
      var sel = document.createElement('select'); sel.className='qsel';
      cfg[2].forEach(function(o){
        var op = document.createElement('option'); op.value=o.v; op.textContent=o.t;
        if(o.v===a[q.id][cfg[0]]) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function(){ a[q.id][cfg[0]] = parseInt(sel.value,10); });
      lab.appendChild(sel); row.appendChild(lab);
    });
    wrap.appendChild(row);
  } else {
    var box = el('div', q.type==='multi' ? 'qchips' : 'qopts');
    q.opts.forEach(function(o){
      var b = el('button','qopt'+(q.type==='multi'?' chip':''));
      var t = el('span','qopt-t', o.t); b.appendChild(t);
      if(o.d) b.appendChild(el('span','qopt-d', o.d));
      function sync(){
        var on = q.type==='multi'
          ? a[q.id].indexOf(o.v)!==-1
          : a[q.id]===o.v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on?'true':'false');
      }
      b.addEventListener('click', function(){
        if(q.type==='multi'){
          var i = a[q.id].indexOf(o.v);
          if(i===-1) a[q.id].push(o.v); else a[q.id].splice(i,1);
        } else { a[q.id] = o.v; }
        sync(); err.hidden = true;
        if(q.type==='single'){ setTimeout(next, 180); }
      });
      sync(); box.appendChild(b);
    });
    wrap.appendChild(box);
  }
  var nav = el('div','qnav');
  var back = el('button','ghostbtn','Back');
  back.disabled = qstate.step===0;
  back.addEventListener('click', function(){ if(qstate.step>0){ qstate.step--; renderQuiz(); } });
  nav.appendChild(back);
  var nextB = el('button','cta', q.type==='multi'&&q.optional ? 'Skip' : 'Next');
  nextB.addEventListener('click', next);
  nav.appendChild(nextB);
  wrap.appendChild(nav);
  function next(){
    if(q.type==='multi' && !q.optional && (!a[q.id]||!a[q.id].length)){ err.hidden=false; return; }
    qstate.step++;
    if(qstate.step>=QUESTIONS.length){ computeResults(); }
    renderQuiz();
  }
}
function computeResults(){
  var w = {};
  Object.keys(WEIGHTS).forEach(function(k){ w[k] = WEIGHTS[k]; });
  if(qstate.weights) w = qstate.weights;
  else qstate.weights = w;
  var scored = scoreAll(qstate.answers, w);
  qstate.results = { scored:scored, picks:pickRecommendations(scored, qstate.answers) };
}

/* ---------- rendering: results ---------- */
function specLine(bike){
  var parts = [];
  parts.push(bike.price!=null ? money(bike.price) : 'Price TBD');
  parts.push(bike.weight!=null ? bike.weight+' lb' : 'weight unverified');
  parts.push(bike.kw!=null ? bike.kw+' kW' : 'power unverified');
  var r = QUIZ_RANGE[bike.id];
  parts.push(r!=null ? '~'+r+' mi est. range' : 'range unknown');
  return parts.join(' · ');
}
function whyBullets(rec, a){
  var out = [], d = rec.detail;
  ['budget','experience','size','power','range','style'].forEach(function(k){
    var r = d[k];
    if(r && r.why && r.why.length && (r.s>=0.75 || r.flags.length)) out.push(r.why[0]);
  });
  return out.slice(0,3);
}
function compromises(rec, a){
  var out = [], d = rec.detail, bike = rec.bike, max = BUDGET_MAX[a.budget];
  if(bike.price!=null && max!==Infinity && bike.price>max)
    out.push(money(bike.price-max)+' over your '+BUDGET_LABEL[a.budget]+' budget');
  if(bike.price==null) out.push('Price not in the catalog yet');
  if(bike.weight==null) out.push('Weight unverified');
  if(bike.kw==null) out.push('Power output unverified');
  if(d.experience.flags.indexOf('power-warning')!==-1) out.push('More power than ideal for your experience — respect the learning curve');
  if(d.size.s < 0.45 && bike.weight!=null) out.push('Size is off your ideal — sit on one before buying');
  if(d.range && d.range.s < 0.6 && QUIZ_RANGE[bike.id]!=null)
    out.push('Est. ~'+QUIZ_RANGE[bike.id]+' mi range is short for your typical rides');
  if(bike.sparse) out.push('New to the catalog — parts fitment still being researched');
  return out;
}
function finLine(bike){
  if(bike.price==null || bike.price < FIN.minPrice) return null;
  var f = finMonthly(bike.price);
  return 'Example financing: '+money(Math.round(f.monthly))+'/mo · '+
    (FIN.apr*100).toFixed(1)+'% APR · '+FIN.termMonths+' mo · '+
    money(Math.round(f.down))+' down · '+money(Math.round(f.financed))+' financed. '+
    'Example only — not an offer, a rate quote, or a financing approval.';
}
function recCard(picks, kind, a){
  var rec = kind==='best'?picks.best : kind==='value'?picks.value : picks.perf;
  if(!rec) return null;
  var bike = rec.bike;
  var card = el('div','qrec');
  var kicker = kind==='best' ? 'Best overall match' : kind==='value' ? 'Best value' : 'Best performance';
  card.appendChild(el('div','qkicker', kicker));
  var top = el('div','qrec-top');
  var img = document.createElement('img');
  img.src = 'img/bike-'+bike.id+'.png'; img.alt = bike.name+' e-moto'; img.loading='lazy';
  img.onerror = function(){ img.style.display='none'; };
  top.appendChild(img);
  var info = el('div','qrec-info');
  info.appendChild(el('h3','', bike.name));
  info.appendChild(el('div','qspecs', specLine(bike)));
  var match = el('div','qmatch');
  match.appendChild(el('span','qmatch-n', rec.pct+'%'));
  match.appendChild(el('span','qmatch-l','match'));
  info.appendChild(match);
  top.appendChild(info); card.appendChild(top);

  /* explainable factor bars */
  var fb = el('div','qfactors');
  Object.keys(FACTORS).forEach(function(k){
    var r = rec.detail[k];
    var row = el('div','qfactor');
    row.appendChild(el('span','qfactor-l', FACTOR_LABEL[k]));
    var bar = el('div','qfactor-bar');
    var fill = el('div','qfactor-fill'); fill.style.width = Math.round(r.s*100)+'%';
    bar.appendChild(fill); row.appendChild(bar);
    row.appendChild(el('span','qfactor-n', Math.round(r.s*100)+'%'));
    fb.appendChild(row);
  });
  card.appendChild(fb);

  var wl = el('ul','qwhy');
  whyBullets(rec, a).forEach(function(t){ wl.appendChild(el('li','',t)); });
  if(wl.children.length) card.appendChild(wl);

  var comp = compromises(rec, a);
  if(comp.length){
    var cw = el('div','qcomp');
    cw.appendChild(el('div','qcomp-h','Worth knowing'));
    var ul = el('ul');
    comp.forEach(function(t){ ul.appendChild(el('li','',t)); });
    cw.appendChild(ul); card.appendChild(cw);
  }
  var fl = finLine(bike);
  if(fl) card.appendChild(el('p','qfin', fl));
  FIN_PARTNERS.forEach(function(p){
    var pa = el('a','qlink', p.name+' — '+p.note); pa.href=p.url; pa.target='_blank'; pa.rel='noopener';
    card.appendChild(pa);
  });
  /* verified purchase link, same treatment as part buy links */
  var buy = (typeof BUY_URLS!=='undefined') ? BUY_URLS[bike.id] : null;
  if(buy && buy.url){
    var ba = el('a','qlink qbuy', 'Buy the '+bike.name+' — '+buy.source);
    ba.href = buy.url; ba.target='_blank'; ba.rel='noopener sponsored';
    card.appendChild(ba);
  }
  var btn = el('button','cta qopen','Start building this bike');
  btn.addEventListener('click', function(){
    if(typeof window.openBikeInBuilder==='function') window.openBikeInBuilder(bike.id);
  });
  card.appendChild(btn);
  return card;
}
function renderResults(wrap){
  var a = qstate.answers, R = qstate.results;
  if(!R) computeResults(), R = qstate.results;
  progressBar(wrap, '100%');
  wrap.appendChild(el('div','qstep','Your matches'));
  wrap.appendChild(el('h2','qtitle','Three bikes worth a look.'));
  wrap.appendChild(el('p','qsub','Match % is a weighted score of budget fit, size & control, power match, experience safety, riding style and estimated range — the bars under each bike show exactly how it earned its number. Nothing here is sponsored; rankings never follow commissions.'));

  var grid = el('div','qgrid');
  ['best','value','perf'].forEach(function(k){
    var c = recCard(R.picks, k, a);
    if(c) grid.appendChild(c);
  });
  wrap.appendChild(grid);

  if(R.picks.stretch){
    var st = el('div','qstretch');
    var b = R.picks.stretch.bike;
    st.appendChild(el('div','qkicker','Stretch pick'));
    st.appendChild(el('p','',
      b.name+' ('+R.picks.stretch.pct+'% match) costs '+money(b.price)+' — over budget, but close enough on fit that it\u2019s worth knowing about.'));
    var btn = el('button','ghostbtn','Open in builder');
    btn.addEventListener('click', function(){
      if(typeof window.openBikeInBuilder==='function') window.openBikeInBuilder(b.id);
    });
    st.appendChild(btn);
    wrap.appendChild(st);
  }

  /* range honesty note */
  wrap.appendChild(el('p','qnote',
    'A note on range: the mileage shown is an owner-reported average / rough estimate, not a manufacturer claim and not a guarantee. '+
    'Real-world range varies with rider weight, terrain, speed, temperature and riding style — ask owners in the e-moto groups before trusting any number.'));

  /* priority sliders */
  var ctl = el('div','qcontrols');
  ctl.appendChild(el('h3','','Tune the ranking'));
  ctl.appendChild(el('p','qsub','Drag to re-weight what matters most. The list re-ranks instantly.'));
  var groups = [
    ['budget','Budget matters most', ['budget']],
    ['fit','Fit & control first', ['size','experience']],
    ['power','Power, style & range', ['power','style','range']]
  ];
  groups.forEach(function(g){
    var row = el('div','qslider-row');
    row.appendChild(el('span','qslider-l', g[1]));
    var inp = document.createElement('input');
    inp.type='range'; inp.min='0'; inp.max='100';
    inp.value = String((qstate.sliderVals&&qstate.sliderVals[g[0]]!=null) ? qstate.sliderVals[g[0]] : 50);
    inp.setAttribute('aria-label', g[1]);
    inp.addEventListener('input', function(){
      var v = parseInt(inp.value,10);
      if(!qstate.sliderVals) qstate.sliderVals = {};
      qstate.sliderVals[g[0]] = v;
      /* set this group's combined weight from the slider, keep the rest proportional */
      var w = {}, keys = Object.keys(qstate.weights);
      var gSum = g[2].reduce(function(n,k){ return n+qstate.weights[k]; }, 0);
      var others = keys.filter(function(k){ return g[2].indexOf(k)<0; });
      var oSum = others.reduce(function(n,k){ return n+qstate.weights[k]; }, 0);
      var target = 0.05 + (v/100)*0.5;
      g[2].forEach(function(k){ w[k] = gSum ? qstate.weights[k]/gSum*target : target/g[2].length; });
      others.forEach(function(k){ w[k] = oSum ? qstate.weights[k]/oSum*(1-target) : (1-target)/others.length; });
      qstate.weights = w;
      var scored = scoreAll(qstate.answers, w);
      qstate.results = { scored:scored, picks:pickRecommendations(scored, qstate.answers) };
      renderQuiz();
    });
    row.appendChild(inp);
    ctl.appendChild(row);
  });
  wrap.appendChild(ctl);

  /* change answers / share / retake */
  var acts = el('div','qactions');
  var chg = el('button','ghostbtn','Change my answers');
  chg.addEventListener('click', function(){ qstate.step = 0; renderQuiz(); });
  var share = el('button','ghostbtn','Copy results link');
  share.addEventListener('click', function(){
    var url = location.origin + location.pathname + '#quiz=' + encodeShare(qstate.answers, qstate.weights);
    function done(){ share.textContent = 'Link copied!'; setTimeout(function(){ share.textContent='Copy results link'; }, 2500); }
    if(navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(url).then(done, function(){ prompt('Copy this link:', url); });
    else prompt('Copy this link:', url);
  });
  var retake = el('button','ghostbtn','Retake quiz');
  retake.addEventListener('click', startQuiz);
  acts.appendChild(chg); acts.appendChild(share); acts.appendChild(retake);
  wrap.appendChild(acts);

  /* upgrade suggestions */
  if(R.picks.best){
    var up = el('div','qups');
    up.appendChild(el('h3','','Suggested upgrades for the '+R.picks.best.bike.name));
    up.appendChild(el('p','qsub','Compatible with your pick, ranked cheapest first. Nothing is pre-selected — opening the builder starts you with a clean slate.'));
    var list = upgradeSuggestions(R.picks.best.bike.id, a.priorities);
    if(!list.length){
      up.appendChild(el('p','qnote','No catalog upgrades listed for this bike yet.'));
    } else {
      var ul = el('ul','quplist');
      list.forEach(function(u){
        var li = el('li','qup');
        li.appendChild(el('span','qup-n', u.name));
        var meta = el('span','qup-m', u.cat+' · '+(u.price!=null?money(u.price):'price TBD')+' · '+(u.fit==='yes'?'fits':'verify fit'));
        li.appendChild(meta);
        ul.appendChild(li);
      });
      up.appendChild(ul);
      var ub = el('button','cta qopen','See it in the builder');
      ub.addEventListener('click', function(){
        if(typeof window.openBikeInBuilder==='function') window.openBikeInBuilder(R.picks.best.bike.id);
      });
      up.appendChild(ub);
    }
    wrap.appendChild(up);
  }
}

/* ---------- entry points ---------- */
function startQuiz(){
  qstate.step = 0;
  qstate.answers = defaultAnswers();
  qstate.results = null;
  qstate.weights = null;
  qstate.sliderVals = null;
  showQuizPane();
  renderQuiz();
}
function showQuizPane(){
  if($('start')) $('start').hidden = true;
  if($('app')) $('app').hidden = false;
  ['tabBuilder','tabBuilds','tabUpcoming','tabCompare'].forEach(function(id){
    var t = $(id); if(t) t.classList.remove('on');
  });
  var tq = $('tabQuiz'); if(tq) tq.classList.add('on');
  ['builderPane','buildsPane','upcomingPane','comparePane'].forEach(function(id){
    var p = $(id); if(p) p.hidden = true;
  });
  var qp = $('quizPane'); if(qp) qp.hidden = false;
  window.scrollTo(0,0);
}
function hideQuizPane(){
  var qp = $('quizPane'); if(qp) qp.hidden = true;
  var tq = $('tabQuiz'); if(tq) tq.classList.remove('on');
}
function init(){
  if(window.__quizInit) return; window.__quizInit = true;
  var tq = $('tabQuiz');
  if(tq) tq.addEventListener('click', function(){
    if(!qstate.answers) startQuiz();
    else { showQuizPane(); renderQuiz(); }
  });
  var bq = $('btnQuiz');
  if(bq) bq.addEventListener('click', startQuiz);
  ['tabBuilder','tabBuilds','tabUpcoming','tabCompare'].forEach(function(id){
    var t = $(id);
    if(t) t.addEventListener('click', hideQuizPane);
  });
  /* shared results link */
  try{
    if(location.hash && location.hash.indexOf('#quiz=')===0){
      var d = decodeShare(location.hash.slice(6));
      if(d){
        qstate.answers = d.answers;
        qstate.weights = d.weights;
        qstate.step = QUESTIONS.length;
        computeResults();
        showQuizPane();
        renderQuiz();
        return;
      }
    }
  }catch(e){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* exposed for QA */
window.__quiz = { QUESTIONS:QUESTIONS, scoreAll:scoreAll, pickRecommendations:pickRecommendations,
  encodeShare:encodeShare, decodeShare:decodeShare, upgradeSuggestions:upgradeSuggestions,
  defaultAnswers:defaultAnswers, finMonthly:finMonthly, WEIGHTS:WEIGHTS, QUIZ_RANGE:QUIZ_RANGE,
  startQuiz:startQuiz };
})();
