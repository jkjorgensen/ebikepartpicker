/* eBikePartsPicker builds — featured builds + build guides.
   parts reference CATEGORIES by {cat, opt} index into data.js.
   "Copy this build" loads them straight into the builder. */

var BUILDS = [
  {
    owner: 'Josh',
    bike: 'ventus-plus',
    img: 'img/bike-ventus-plus-wheels-warp9.png',
    title: 'Ventus One Plus — full build',
    parts: [
      {cat:'wheels', opt:1},
      {cat:'fork', opt:1},
      {cat:'shock', opt:5},
      {cat:'controller', opt:2},
      {cat:'plastics', opt:3}
    ],
    extras: [{name:'Warp 9 foot pegs', price:109}]
  }
];

/* Build guides: budget / smart money / dream for the most popular bikes.
   Every part is in the catalog with a real buy link. */
var GUIDES = [
  {bike:'lightbee', tier:'budget', name:'Budget build',
   blurb:'First upgrades that matter: stop better, sit better.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:2}]},
  {bike:'lightbee', tier:'smart', name:'Smart money build',
   blurb:'The sweet spot: real power and suspension without going full race.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:2},{cat:'shock', opt:3},{cat:'brakes', opt:1}]},
  {bike:'lightbee', tier:'dream', name:'Dream build',
   blurb:'No compromises: the full race build.',
   parts:[{cat:'motor', opt:1},{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1},{cat:'brakes', opt:2},{cat:'plastics', opt:1}]},

  {bike:'ventus-plus', tier:'budget', name:'Budget build',
   blurb:'Cheap wins: better brakes and fresh graphics.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:3}]},
  {bike:'ventus-plus', tier:'smart', name:'Smart money build',
   blurb:'Suspension transforms the bike: the enthusiast pick.',
   parts:[{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'brakes', opt:2}]},
  {bike:'ventus-plus', tier:'dream', name:'Dream build',
   blurb:'Josh\u2019s formula: full EXT, Warp 9s, done right.',
   parts:[{cat:'wheels', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'controller', opt:2},{cat:'brakes', opt:2},{cat:'plastics', opt:1}]},

  {bike:'ss20', tier:'budget', name:'Budget build',
   blurb:'Small money, big feel: brakes and a fresh seat cover.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:1}]},
  {bike:'ss20', tier:'smart', name:'Smart money build',
   blurb:'Unlock the platform: controller, suspension, supermoto wheels.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:2}]},
  {bike:'ss20', tier:'dream', name:'Dream build',
   blurb:'Everything the SS 2.0 can be: motor, controller, full EXT.',
   parts:[{cat:'motor', opt:1},{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1},{cat:'brakes', opt:2},{cat:'plastics', opt:1}]},

  {bike:'ultrabee', tier:'budget', name:'Budget build',
   blurb:'Cheap wins: stop better, look better.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:5}]},
  {bike:'ultrabee', tier:'smart', name:'Smart money build',
   blurb:'Unlock the platform: controller and suspension transform the bike.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:7},{cat:'wheels', opt:1}]},
  {bike:'ultrabee', tier:'dream', name:'Dream build',
   blurb:'The full Ventus/VTB powertrain: Ryuga 81kW, V9600, 96V battery. No compromises.',
   parts:[{cat:'motor', opt:7},{cat:'controller', opt:5},{cat:'batteries', opt:9},{cat:'fork', opt:10},{cat:'shock', opt:8},{cat:'wheels', opt:9},{cat:'brakes', opt:2}]},

  {bike:'mx4', tier:'budget', name:'Budget build',
   blurb:'Fresh pads, fresh graphics: the cheap refresh.',
   parts:[{cat:'brakes', opt:11},{cat:'plastics', opt:4}]},
  {bike:'mx4', tier:'smart', name:'Smart money build',
   blurb:'The sweet spot: real power and suspension without going full race.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1}]},
  {bike:'mx4', tier:'dream', name:'Dream build',
   blurb:'No compromises: the full race MX4.',
   parts:[{cat:'motor', opt:3},{cat:'controller', opt:1},{cat:'batteries', opt:3},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1},{cat:'brakes', opt:2}]},

  {bike:'ss30', tier:'budget', name:'Budget build',
   blurb:'Small money, big feel: brakes and a fresh seat cover.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:1}]},
  {bike:'ss30', tier:'smart', name:'Smart money build',
   blurb:'Unlock the platform: controller, suspension, fresh wheels.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1}]},
  {bike:'ss30', tier:'dream', name:'Dream build',
   blurb:'Everything the SS 3.0 can be: motor, controller, battery, full EXT.',
   parts:[{cat:'motor', opt:1},{cat:'controller', opt:1},{cat:'batteries', opt:6},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:5},{cat:'brakes', opt:2}]},

  {bike:'mx5', tier:'budget', name:'Budget build',
   blurb:'Cheap wins: stop better, sit better.',
   parts:[{cat:'brakes', opt:1},{cat:'plastics', opt:1}]},
  {bike:'mx5', tier:'smart', name:'Smart money build',
   blurb:'The sweet spot on the 72V platform: controller and suspension.',
   parts:[{cat:'controller', opt:1},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1}]},
  {bike:'mx5', tier:'dream', name:'Dream build',
   blurb:'No compromises: the full race MX5 Pro.',
   parts:[{cat:'motor', opt:3},{cat:'controller', opt:1},{cat:'batteries', opt:3},{cat:'fork', opt:1},{cat:'shock', opt:5},{cat:'wheels', opt:1},{cat:'brakes', opt:2}]}
];
