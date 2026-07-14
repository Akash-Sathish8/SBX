/* ============================================================================
   Shared CROWD dataset — the whole point: every PHOTO belongs to a specific
   fan's review/tip. Many fans, many contributions. All mockups render from this
   so the cast, the photos, and the photo→author bindings are identical everywhere.

   Photos are real frames from public/img/reports/citi/robby (placeholders), but
   here each one is OWNED by the fan who "took" it.
   ========================================================================== */
const P = '../../public/img/reports/citi/robby/';

window.CROWD = {
  venue: { name:'Madison Square Garden', team:'New York Knicks', city:'New York, NY',
           snap:'9.2', rank:3, fan:'8.7', reviews:214, tips:128, fans:73 },

  // fan directory — jack is the verified voice (logo avatar), the rest are fans
  fans: {
    jack:   {name:'Jack Settleman', ini:'JS', color:'#141410', verified:true, avatar:'../../public/img/logo.png'},
    mike:   {name:'Mike D.',   ini:'MD', color:'#c0392b'},
    sarah:  {name:'Sarah K.',  ini:'SK', color:'#2b6cb0'},
    tommy:  {name:'Tommy V.',  ini:'TV', color:'#6b46c1'},
    jenn:   {name:'Jenn R.',   ini:'JR', color:'#b7791f'},
    marcus: {name:'Marcus L.', ini:'ML', color:'#2f855a'},
    danny:  {name:'Danny P.',  ini:'DP', color:'#c53030'},
    carl:   {name:'Carl W.',   ini:'CW', color:'#285e61'},
    nina:   {name:'Nina P.',   ini:'NP', color:'#97266d'},
    leo:    {name:'Leo G.',    ini:'LG', color:'#4a5568'},
    rob:    {name:'Rob M.',    ini:'RM', color:'#9c4221'},
    elliot: {name:'Elliot S.', ini:'ES', color:'#1a365d'},
    grace:  {name:'Grace V.',  ini:'GV', color:'#702459'},
    priya:  {name:'Priya N.',  ini:'PN', color:'#22543d'},
  },

  sections: [
    {key:'best-seats',    label:'Best Seats'},
    {key:'food',          label:'Best Food'},
    {key:'getting-there', label:'Getting There'},
    {key:'before',        label:'Before the Game'},
    {key:'atmosphere',    label:'Atmosphere'},
    {key:'tips',          label:'Insider Tips'},
  ],

  // TIPS — each authored; when a tip has `photo`, that photo is the AUTHOR'S shot,
  // bound to their tip (this is the association the whole redesign is about).
  tips: [
    // best seats
    {section:'best-seats', by:'jack',   up:41, ago:'pinned', pinned:true, text:'Front rows in the 200s, center sections beat behind the basket, even down low.', photo:{src:P+'r10.jpg', area:'100 Level'}},
    {section:'best-seats', by:'tommy',  up:36, ago:'2w', text:'The Hyundai Bridge is the best value seat in the building. Get there for warmups, it fills up fast.', photo:{src:P+'r40.jpg', area:'Hyundai Bridge'}},
    {section:'best-seats', by:'sarah',  up:24, ago:'3w', text:'Sections 104-105 by the tunnel — you see the players walk out. My kids loved it.', photo:{src:P+'r56.jpg', area:'104 Tunnel'}},
    {section:'best-seats', by:'marcus', up:19, ago:'1mo', text:'Skip the last 3 rows of the 200s, the overhang cuts off the scoreboard.'},
    {section:'best-seats', by:'leo',    up:12, ago:'1mo', text:'Chase Bridge is cool once, but you are far from the floor. Do it for the photos, not the game.', photo:{src:P+'r49.jpg', area:'Chase Bridge'}},
    {section:'best-seats', by:'priya',  up:9,  ago:'2mo', text:'If you are tall, aisle seats in 213/214 have way more legroom.'},

    // food
    {section:'food', by:'jack',  up:57, ago:'pinned', pinned:true, text:'Best food in MSG is the steak sandwich outside section 107.', photo:{src:P+'r25.jpg', area:'Steak Sandwich'}},
    {section:'food', by:'mike',  up:48, ago:'5d', text:'Second the steak sandwich. Get it before tip or the line is 20 deep by the 1st quarter.', photo:{src:P+'r30.jpg', area:'Sec 107 line'}},
    {section:'food', by:'jenn',  up:33, ago:'2w', text:'Garden Market burger is the move. The hot honey chicken is underrated too.', photo:{src:P+'r26.jpg', area:'Garden Market'}},
    {section:'food', by:'danny', up:27, ago:'3w', text:'Skip the pizza, everyone is right. The chopped cheese near 109 is actually solid.', photo:{src:P+'r01.jpg', area:'Concessions'}},
    {section:'food', by:'carl',  up:21, ago:'1mo', text:'Kosher cart by 115 has a great pastrami. If you know, you know.', photo:{src:P+'r33.jpg', area:'Cart @115'}},
    {section:'food', by:'grace', up:16, ago:'1mo', text:'Boomers fries. That is the whole tip.', photo:{src:P+'r34.jpg', area:'Fries'}},

    // getting there
    {section:'getting-there', by:'jack', up:38, ago:'pinned', pinned:true, text:'Best ways in: walking, the subway, the LIRR, or NJ Transit. Driving would be my last choice.', photo:{src:P+'r59.jpg', area:'Outside'}},
    {section:'getting-there', by:'rob',  up:22, ago:'1w', text:'Come out of Penn and use the 7th Ave entrance, way less of a crush than 8th.', photo:{src:P+'r20.jpg', area:'7th Ave gates'}},
    {section:'getting-there', by:'nina', up:14, ago:'3w', text:'If you must drive, the Icon garage on 31st is cheaper if you prepay online.', photo:{src:P+'r12.jpg', area:'Concourse'}},
    {section:'getting-there', by:'mike', up:10, ago:'1mo', text:'The A/C/E to 34th drops you right at the door. The 1/2/3 is a block walk.'},

    // before the game
    {section:'before', by:'jack', up:22, ago:'pinned', pinned:true, text:"Pregame spots nearby: Nick and Stef's, The Rutherford, Stout, Mustang Harry's, American Whiskey.", photo:{src:P+'r44.jpg', area:'Chase Lounge'}},
    {section:'before', by:'carl', up:17, ago:'4d', text:'Stout gets slammed. Liberty NYC on 33rd has more room and cheaper pitchers.', photo:{src:P+'r51.jpg', area:'Bar'}},
    {section:'before', by:'leo',  up:12, ago:'2w', text:'The Chase reserve lounge is legit if you have the card, quiet place to sit before doors.', photo:{src:P+'r57.jpg', area:'Delta Club'}},
    {section:'before', by:'tommy',up:9,  ago:'1mo', text:"Do the Nick and Stef's happy hour, then walk over. Best pregame in the area.", photo:{src:P+'r45.jpg', area:'Lounge'}},

    // atmosphere
    {section:'atmosphere', by:'jack',   up:63, ago:'pinned', pinned:true, text:'Best crowd in the NBA. Be ready to stand, seats are tight. Plenty of in-game stuff like t-shirt tosses.', photo:{src:P+'r17.jpg', area:'Tip-off'}},
    {section:'atmosphere', by:'grace',  up:51, ago:'6d', text:'When the Knicks go on a run the building is unreal. Nothing like a playoff MSG.', photo:{src:P+'r18.jpg', area:'The crowd'}},
    {section:'atmosphere', by:'elliot', up:18, ago:'2w', text:'Bring earplugs for the little ones, it gets genuinely loud in the 4th.', photo:{src:P+'r19.jpg', area:'Concourse'}},
    {section:'atmosphere', by:'danny',  up:15, ago:'3w', text:"Spike Lee is usually courtside. Half the fun is the celeb-spotting."},
    {section:'atmosphere', by:'sarah',  up:12, ago:'1mo', text:'Not super family-friendly on a rowdy night, but the energy is worth it.', photo:{src:P+'r15.jpg', area:'Concourse'}},

    // insider tips
    {section:'tips', by:'jack',  up:31, ago:'pinned', pinned:true, text:'The merch store through the 100 level gates has a way shorter line than the MSG lobby.', photo:{src:P+'r04.jpg', area:'Team Store'}},
    {section:'tips', by:'danny', up:29, ago:'1w', text:'Alcohol is brutal, $18 beers. Handle it before you come in.'},
    {section:'tips', by:'sarah', up:21, ago:'2w', text:'Restrooms on the 200 level are way less crowded than the 100s at halftime.'},
    {section:'tips', by:'priya', up:17, ago:'3w', text:'Mobile ticket only, download the MSG app before you get there, signal is bad inside.', photo:{src:P+'r64.jpg', area:'Ticket'}},
    {section:'tips', by:'rob',   up:11, ago:'1mo', text:'The Chase Bridge entrance has the shortest security line most nights.', photo:{src:P+'r63.jpg', area:'Merch'}},
    {section:'tips', by:'grace', up:8,  ago:'1mo', text:'Free water refill stations near the ramps, do not buy the $6 bottles.', photo:{src:P+'r02.jpg', area:'Concourse'}},
  ],

  // FULL REVIEWS — a fan's overall take with the photos THEY posted attached.
  reviews: [
    {by:'grace', rating:9, up:88, ago:'6d', body:'First playoff game and I get why people lose their minds over this place. Loud from the jump, the steak sandwich lived up to the hype, and our 200s center seats were perfect.', photos:[{src:P+'r18.jpg',area:'The crowd'},{src:P+'r17.jpg',area:'Tip-off'}]},
    {by:'mike',  rating:8, up:64, ago:'2w', body:'Food slaps, seats were tight, worth every dollar for the atmosphere. Steak sandwich as advertised, just get there before tipoff. Docking a point for the beer prices.', photos:[{src:P+'r30.jpg',area:'Sec 107'},{src:P+'r26.jpg',area:'Garden Market'}]},
    {by:'rob',   rating:7, up:41, ago:'3w', body:'Getting in was a mess with the Penn construction, but once you are inside it is the best building in sports. Came in the 7th Ave side like the tips said and it was much smoother.', photos:[{src:P+'r59.jpg',area:'Outside'},{src:P+'r20.jpg',area:'Gates'}]},
    {by:'sarah', rating:8, up:33, ago:'1mo', body:'Brought the kids to 104 by the tunnel and they got to see the walkout. Restrooms on 200 saved us at half. A little rowdy but a great first Knicks game for them.', photos:[{src:P+'r56.jpg',area:'104 Tunnel'}]},
    {by:'tommy', rating:9, up:29, ago:'1mo', body:'Hyundai Bridge is my go-to now. Cheapest ticket, best value view of the floor, and you can actually move around up there. Did the Nick and Stefs happy hour first.', photos:[{src:P+'r40.jpg',area:'Hyundai Bridge'},{src:P+'r45.jpg',area:'Pregame'}]},
    {by:'danny', rating:7, up:22, ago:'1mo', body:'Chopped cheese near 109 is the sleeper. Skip the pizza. Alcohol is highway robbery so I handle that before. Celeb-spotting from the 200s is half the fun.', photos:[{src:P+'r01.jpg',area:'Concessions'}]},
  ],

  // PILLAR SCORES for the dashboard concept — each backed by fan reviews (with
  // their own photos), so every score is justified by an attributed image + quote.
  pillars: [
    {key:'fans',    label:'Fans',    score:'9.4', evidence:[
      {by:'jack',  photo:{src:P+'r17.jpg',area:'Tip-off'},  quote:'Best crowd in the NBA. Be ready to stand.'},
      {by:'grace', photo:{src:P+'r18.jpg',area:'The crowd'}, quote:'On a run, the building is unreal.'},
    ]},
    {key:'food',    label:'Food',    score:'8.9', evidence:[
      {by:'jack', photo:{src:P+'r25.jpg',area:'Steak Sandwich'}, quote:'Steak sandwich outside 107 is the best in the building.'},
      {by:'jenn', photo:{src:P+'r26.jpg',area:'Garden Market'},  quote:'Garden Market burger is the move.'},
    ]},
    {key:'unique',  label:'Unique',  score:'9.5', evidence:[
      {by:'tommy', photo:{src:P+'r40.jpg',area:'Hyundai Bridge'}, quote:'Best value view of the floor in the building.'},
      {by:'jack',  photo:{src:P+'r10.jpg',area:'100 Level'},      quote:'Center 200s beat behind the basket, even down low.'},
    ]},
    {key:'stadium', label:'Stadium', score:'8.8', evidence:[
      {by:'rob',  photo:{src:P+'r59.jpg',area:'Outside'},   quote:'Come in the 7th Ave side, much smoother.'},
      {by:'nina', photo:{src:P+'r12.jpg',area:'Concourse'}, quote:'Concourses get tight but flow fine on transit nights.'},
    ]},
  ],

  // ---- tiny render helpers (use shared classes .av/.ini/.nm/.vf/.vote/.credit) ----
  fan(id){ return this.fans[id]; },
  tipsFor(key){ return this.tips.filter(t => t.section === key); },
  photosFor(key){ return this.tipsFor(key).filter(t => t.photo).map(t => ({...t.photo, by:t.by})); },
  avatar(id){ const f=this.fans[id]; return f.verified
    ? `<img class="av" src="${f.avatar}" alt="">`
    : `<span class="ini" style="background:${f.color}">${f.ini}</span>`; },
  nameTag(id){ const f=this.fans[id]; return `<span class="nm">${f.name}</span>${f.verified?'<span class="vf">✓</span>':''}`; },
  votePill(n){ return `<span class="vote"><button>▲</button><span class="n">${n}</span><button>▼</button></span>`; },
  credit(id){ const f=this.fans[id]; return `<span class="credit">${this.avatar(id)}${f.name}</span>`; },
};
