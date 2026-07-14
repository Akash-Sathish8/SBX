/* Shared content for every mockup. Real seeded data:
   - Venue: Madison Square Garden (New York Knicks), ESPN id 1830
   - Tips: Jack Settleman's REAL seeded MSG tips (scripts/seed-jack.mjs) — he'll
     recognize his own words in the new layout.
   - Photos: real field-report frames from public/img/reports/citi/robby (used as
     PLACEHOLDER imagery; the layout is what's being decided). Paths are relative
     to a mockup file in this folder.
*/
const P = '../../public/img/reports/citi/robby/';

window.SBX = {
  venue: {
    name: 'Madison Square Garden',
    team: 'New York Knicks',
    city: 'New York, NY',
    snapScore: '9.2',
    snapRank: 3,
    fanScore: '8.7',
    fanCount: 214,
  },
  jack: { name: 'Jack Settleman', avatar: '../../public/img/logo.png', verified: true },

  // photos grouped the way the field report already groups them
  photos: {
    seats:   [{s:P+'r10.jpg',a:'100 Level'},{s:P+'r40.jpg',a:'300 Level'},{s:P+'r56.jpg',a:'400 Level'}],
    food:    [{s:P+'r25.jpg',a:'Steak Sandwich'},{s:P+'r30.jpg',a:'Garden Market'},{s:P+'r01.jpg',a:'Concessions'},{s:P+'r26.jpg',a:'Burgers'},{s:P+'r33.jpg',a:'Food'},{s:P+'r34.jpg',a:'Food'},{s:P+'r38.jpg',a:'Menus'}],
    lounges: [{s:P+'r44.jpg',a:'Chase Lounge'},{s:P+'r45.jpg',a:'Lounge'},{s:P+'r49.jpg',a:'Lounge'},{s:P+'r51.jpg',a:'Bar'},{s:P+'r57.jpg',a:'Delta Club'}],
    stadium: [{s:P+'r59.jpg',a:'Outside'},{s:P+'r20.jpg',a:'Gates'},{s:P+'r12.jpg',a:'Concourse'},{s:P+'r14.jpg',a:'Concourse'},{s:P+'r15.jpg',a:'Concourse'},{s:P+'r17.jpg',a:'Concourse'},{s:P+'r18.jpg',a:'Concourse'},{s:P+'r19.jpg',a:'Concourse'},{s:P+'r04.jpg',a:'Team Store'},{s:P+'r63.jpg',a:'Team Store'}],
    hero: P+'r10.jpg',
  },

  // Jack's tips per section (his exact seeded words)
  sections: {
    'getting-there': { label:'Getting there', tips:[
      'Best ways in: walking, the subway, the LIRR, or NJ Transit. Driving would be my last choice.'] },
    'best-seats': { label:'Best seats', tips:[
      'Front rows in the 200s in the center sections beat behind the basket, even down low.',
      'The Chase Bridge and the Hyundai Bridge are both cool spots, and the Hyundai Bridge is good value.',
      'The Delta Club comes with all-inclusive food and drink (non-alcoholic).'] },
    'food': { label:'Best food', tips:[
      'Best food in MSG is the steak sandwich outside section 107.',
      'The hamburgers from the Garden Market are the best basic food item in sports. They use a different type of bun that is fantastic.',
      'Carnegie Deli is another good one. Skip the pizza, it is bad in the arena.'] },
    'before': { label:'Before the game', tips:[
      "Pregame spots nearby: Nick and Stef's Steakhouse, The Rutherford, Stout, Mustang Harry's, and American Whiskey.",
      'There is a Chase reserve lounge inside the arena. You can reserve a spot pregame.'] },
    'atmosphere': { label:'Atmosphere', tips:[
      'Best crowd in the NBA. Be ready to stand, and the seats are tight between people. There are not as many gimmicks as other NBA arenas, so it is not the most family-friendly, but there is still plenty of in-game entertainment like t-shirt tosses.'] },
    'tips': { label:'Insider tips', tips:[
      'The merch store through the gates on the 100 level has a way shorter line than the one in the MSG lobby.',
      'Alcoholic drinks are very expensive inside MSG.'] },
  },

  review: "Best crowd in the NBA. Be ready to stand and the seats are tight, but the energy is worth it. For seats, the front rows in the 200s in the center sections beat behind the basket even down low, and the Hyundai Bridge is a cool spot with good value. Eat the steak sandwich outside section 107 and the Garden Market hamburgers, and skip the arena pizza. Get in through the 100 level gates for a shorter merch line, and know the alcohol is very expensive.",

  // the gameday told in order (for timeline / story / field-guide concepts)
  story: [
    { step:'Arrive',      photo:P+'r59.jpg', tip:'Best ways in: walking, the subway, the LIRR, or NJ Transit. Driving would be my last choice.' },
    { step:'Get in',      photo:P+'r20.jpg', tip:'Get in through the 100 level gates — way shorter merch line than the MSG lobby.' },
    { step:'Pregame',     photo:P+'r44.jpg', tip:'There is a Chase reserve lounge inside the arena. You can reserve a spot pregame.' },
    { step:'Your seat',   photo:P+'r10.jpg', tip:'Front rows in the 200s in the center sections beat behind the basket, even down low.' },
    { step:'Eat',         photo:P+'r25.jpg', tip:'Best food in MSG is the steak sandwich outside section 107. Skip the pizza.' },
    { step:'The crowd',   photo:P+'r17.jpg', tip:'Best crowd in the NBA. Be ready to stand — the energy is worth it.' },
    { step:'Merch',       photo:P+'r04.jpg', tip:'Alcoholic drinks are very expensive inside MSG. Budget for it.' },
  ],
};
