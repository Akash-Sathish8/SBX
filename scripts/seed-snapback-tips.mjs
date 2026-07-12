// Seed Snapback's official gameday tips + reviews for every venue Snapback has
// visited, curated from Snapback's own videos. Editorial first-party content
// attributed to the official Snapback account (id 'snapback-official', rendered
// with the logo + verified badge), NOT faked as fans. Mirrors ingest.mjs's emit.
//
// MULTI-VENUE: add a block to VENUES for each transcript. Apply with:
//   npm run db:seed:snapback-tips        # (re)generate the SQL
//   npm run db:seed:snapback-tips:local  # apply to local D1
//
// The generated SQL clears ALL tips and all official reviews first (clean slate),
// then re-inserts every venue below. No em dashes anywhere.

import { writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'db', 'seed.snapback-tips.generated.sql')
const OFFICIAL = { id: 'snapback-official', email: 'official@snapbacksports.com', username: 'Snapback', author: 'Snapback' }

// One block per venue Snapback has visited. id = ESPN venue id. tips = [section, body].
const VENUES = [
  {
    id: '3632', name: 'Beaver Stadium',
    tips: [
      ['getting-there', "Logistics are rough. Bad traffic in and out, long bathroom and food lines, and basically no phone service inside. Screenshot your tickets and set a meetup spot beforehand."],
      ['getting-there', "State College is a haul. It is a small regional airport and you will likely connect through somewhere. Treat it as a fly-in-for-the-weekend, one-and-done trip."],
      ['best-seats', "Tightest bleacher seating we have ever sat in. It is raw, authentic college football, but expect zero legroom and no room to spread out."],
      ['best-seats', "The stadium itself is not fancy and there is no room to spare. You are here for the crowd and the spectacle, not the amenities."],
      ['food', "Food is the weak spot. We scored it a 4 out of 10. Skip the cheesesteak, it is dry here. Grab chicken tenders and fries and call it a day."],
      ['food', "Treat stadium food as halftime fuel only. Tailgate all day, then grab tenders, fries, and the donut bites once you are inside."],
      ['before', "Tailgating is the event here. Grills going all day, footballs flying everywhere. Get there early and post up before kickoff."],
      ['before', "Pre-game move: hit anti-fragile, a newer brewery in town."],
      ['before', "Look for a communion tailgate. Fans run a prayer and a song and toast Fireball after the first down and every touchdown. It is a Penn State tradition worth catching."],
      ['atmosphere', "The White Out is widely regarded as the single greatest atmosphere in college football. The whole place goes all white, plus fireworks and Mo Bamba. Walking out of the tunnel into it is genuinely breathtaking."],
      ['atmosphere', "Beaver Stadium is the second biggest stadium in the country, around 107k, and it is loudest for marquee games. Fans said the pick six against Ohio State was the loudest they had ever heard it."],
      ['tips', "There is only one White Out a year, and it truly peaks as a night game against a top rival like Ohio State or Michigan. If you can pick your game, pick that one."],
      ['tips', "Wear all white. That is the entire point. Showing up in your own team colors to a White Out misses it."],
      ['tips', "Pair the trip with campus. Old Main and the fall foliage in Happy Valley are gorgeous. See the White Out once, soak in State College, and call it a great weekend."],
    ],
    review: {
      rating: 7,
      body: [
        "Went up for the White Out and the atmosphere absolutely lived up to the hype. 107,000 people all in white, the lights drop, the fireworks go off and they blast Mo Bamba, and walking out of that tunnel honestly gave me chills. When the whole place is locked in it is the loudest thing I have ever been a part of.",
        "",
        "Real talk though, the rest of it is rough. We tailgated all day and that was the best part, grills everywhere, footballs flying, people just handing you food. But inside the stadium the food is bad, just get the chicken tenders and fries and keep your expectations low. The bleachers are packed so tight you are basically sitting on the person next to you, there is no phone service, and the lines and traffic are a grind.",
        "",
        "The honest truth is the game makes or breaks it. We caught a blowout against Washington and a big chunk of the crowd left by the third quarter, so we never got that signature White Out moment late. If you can get here for a night game against Ohio State or Michigan, that is when this place is a 10. For a regular White Out it is still worth seeing once, especially paired with a weekend in Happy Valley, but it is a long expensive trip so plan around the right opponent.",
      ].join('\n'),
    },
  },
  {
    id: '30', name: 'Chase Field',
    tips: [
      ['food', "The priciest item is the $30 jalapeno bacon Philly fry, served in a helmet you can actually wear. We did a full lap and it was the most expensive thing in the park, and it is genuinely good, a 7.9 out of 10."],
    ],
    review: null,
  },
  {
    id: '1949', name: 'Mortgage Matchup Center (Suns)',
    tips: [
      ['food', "The most expensive item is only a $17 chicken Philly, about a 6 out of 10. Get it early. It is best fresh in the first quarter and slides downhill sitting out."],
      ['getting-there', "Buy your tickets ahead of time. The box office closed during the game and the ticketing apps stopped selling once it was underway."],
    ],
    review: null,
  },
  {
    id: '3752', name: 'Acrisure Stadium',
    tips: [
      ['food', "Food is rough. The nicest item from Prantl Bros, the pittsburger, came in at a 1.8 out of 10 with an untoasted bun and soggy fries. Keep expectations low."],
      ['food', "Club level food is a real upgrade. We had southwestern chicken egg rolls and a chicky pizza for $36, about a 6.9, and it was actually good. Pay up for the better seats if you can."],
      ['best-seats', "The stadium is a concrete ice pit and Renegade can feel underwhelming, but the crowd shows up for prime-time games. Even a game the media called unwatchable turned into a shootout."],
      ['atmosphere', "Steelers fans are brutally honest about their own team and will heckle their own side when it is going badly. It can get rowdy, but they were friendly to us as visitors."],
      ['tips', "There is a tradition where first-timers on the field eat a piece of the grass. The fans will absolutely make you do it."],
    ],
    review: {
      rating: 4,
      body: [
        "Pittsburgh gets a bad rap and honestly some of it is earned. The Prantl Bros pittsburger is rough, untoasted bun and soggy fries, and the stadium is a concrete ice pit where Renegade did not do much for me.",
        "",
        "But here is the thing. When we came back and got club level seats the food was a real upgrade, and even a prime-time game the entire media said was unwatchable turned into a shootout. The fans are brutally honest about their own team but they show up. It is not bucket list, but it is better than its reputation, and watch out, the fans will make you eat a piece of the field grass.",
      ].join('\n'),
    },
  },
  {
    id: '3933', name: 'Soldier Field',
    tips: [
      ['getting-there', "Getting in is fast, often 15 to 20 minutes or less despite what the reviews say. The catch is getting out. Longtime fans say it can take close to an hour to leave after the game."],
      ['getting-there', "The traffic here rivals Los Angeles. Plan extra time on both ends."],
      ['before', "Parking and tailgating are a highlight. Get there early and tailgate, regulars say it is the best part of the day."],
      ['food', "Get the hot dog, it is a genuinely good dog. Skip the pizza, it is small, cold and not good. The concession staff were friendly and quick."],
      ['atmosphere', "The fans are the whole show. Loud and screaming the entire game even when the Bears are bad, and friendly with no real attitude. Easily a five star crowd."],
      ['tips', "Ignore the one star reviews. The grass is green, getting in is quick, and the staff are nice. The team may struggle but the experience holds up."],
    ],
    review: {
      rating: 8,
      body: [
        "Everyone warned us Soldier Field would be the worst experience in the NFL, and it was the opposite. We got in under two minutes, not the hour the reviews swore by.",
        "",
        "The fans are unreal, loud and screaming the whole game even though the Bears are not good, and friendly the entire time, no attitude and no shoving. Get the hot dog, it is a quality dog, but skip the pizza, it is cold and tiny. The stadium is old, the food is mostly terrible and the traffic rivals LA, those are the real knocks.",
        "",
        "Even so, this was an easy great night. The fan base is obsessive and they suck you in. On atmosphere alone you will be smiling ear to ear, and I would go back tomorrow.",
      ].join('\n'),
    },
  },
  {
    id: '3839', name: 'MetLife Stadium',
    tips: [
      ['before', "Get there early for the tailgate. There were free samples, beer flowing, and tons of throwback jerseys around the lot."],
      ['atmosphere', "Jets fans are friendly despite the New York reputation. Fireman Ed, the longtime Jets superfan, sits up in the club section, section 114."],
      ['best-seats', "Honest warning, the stadium is ugly and it gets freezing cold, and the food is beyond mid. For a bad matchup this is a skip."],
    ],
    review: {
      rating: 3,
      body: [
        "I live less than ten miles from MetLife and I will still say it, this is a wouldn't go if you paid me experience for a bad game. The stadium is ugly, it was freezing, the food is beyond mid, and the matchup we caught was awful enough that we left early.",
        "",
        "The tailgate does have some life, free samples and throwback jerseys everywhere, and Jets fans are friendlier than the New York reputation suggests. But unless it is a big game, there are far better trips.",
      ].join('\n'),
    },
  },
  {
    id: '3687', name: 'AT&T Stadium',
    tips: [
      ['atmosphere', "The stadium is a spectacle. It is a $1.3 billion complex so massive that a Statue of Liberty standing on the Dallas star at midfield would not reach the roof. There is even a car dealership inside."],
      ['getting-there', "AT&T Stadium is a bit tough to navigate. Give yourself extra time to find your section."],
      ['food', "The Cowboys cheese Philly, their take on a cheesesteak, and the brisket sandwich are the moves. If you get suite access, the spread including the Cheeto-dust popcorn is insanely good."],
      ['atmosphere', "Heads up, a lot of Cowboys fans are entitled and loud about glory that is 30 years old. The place still delivers on scale and big games."],
      ['tips', "If you can, tour Jerry World on a non-game day. The locker room, Jerry Jones suite, and the views are worth it on their own and push the whole thing toward bucket list."],
    ],
    review: {
      rating: 8,
      body: [
        "AT&T Stadium is a spectacle. It is a $1.3 billion building, so huge that the Statue of Liberty on the midfield star would not touch the roof, and yes there is a car dealership inside.",
        "",
        "We got field passes before and after the game and a full suite spread, and the Cheeto-dust popcorn was unreasonably good. We also caught the best game of the entire season here, 76 points. The fans can be a little entitled and the place is tough to navigate, but the scale is unreal. If you can swing a non-game-day tour of the locker room and Jerry's suite, it pushes the whole thing right up against bucket list.",
      ].join('\n'),
    },
  },
  {
    id: '3622', name: 'GEHA Field at Arrowhead Stadium',
    tips: [
      ['atmosphere', "This is the loudest set of fans in football. Between the chop and the chance of Mahomes magic on any play, Arrowhead stays in a frenzy all game."],
      ['food', "The food is unreal. Our top rated stadium item of the entire season was here, an ice cream dish we scored a 9 with the ice cream."],
      ['tips', "Kansas City the city leaves something to be desired, so plan the trip around the game. If you eat anywhere, Joe'sBarbecue is the best we have ever had."],
    ],
    review: {
      rating: 8,
      body: [
        "Arrowhead is the loudest building in football, full stop. Between the chop and Mahomes being able to make magic on any snap, the place is in a frenzy the whole game.",
        "",
        "The food is also the best we had all season, our top rated item of the year was here, an ice cream dish that is a 9. The only reason it is not bucket list for us is that Kansas City the city leaves a bit to be desired. Come for the game and hit Joe'sBarbecue, which is the best we have ever had.",
      ].join('\n'),
    },
  },
  {
    id: '3806', name: 'Lincoln Financial Field',
    tips: [
      ['atmosphere', "Eagles fans are the best in football as long as you are on their good side. Do not show up as an opposing fan, and do not show up if you are not bringing your best energy."],
      ['food', "The stadium itself is nothing special and the food is really bad. Come for the crowd and the game, not the concessions."],
      ['before', "Tailgate first, the cheesesteaks and Go Birds energy outside are the best part. We would not bring anyone under 21."],
    ],
    review: {
      rating: 8,
      body: [
        "Philly is an A-tier experience carried entirely by its fans, the best in football as long as you are on their good side. We hosted a tailgate with a hundred of our own fans, cheesesteaks and Go Birds everywhere, and that pregame is the highlight.",
        "",
        "Inside, the stadium is nothing special and the food is really bad, so just lock into the game. Fair warning, it gets rowdy and we would not bring anyone under 21, but if you want raw passion this is it.",
      ].join('\n'),
    },
  },
  {
    id: '4738', name: "Levi's Stadium",
    tips: [
      ['before', "The Niners have the best tailgate in football, better than Buffalo. We got free tacos and tequila just for winning a trivia game in the lot."],
      ['best-seats', "This is the most beautiful outdoor stadium in the NFL with great food options and an elite team. Worth the trip even if it means a long flight plus an hour drive down to Santa Clara."],
      ['atmosphere', "One honest knock, the fans can be quiet and not everyone stands, especially in a blowout. The stadium and the food carry it."],
    ],
    review: {
      rating: 9,
      body: [
        "Levi's is a bucket-list experience and it surprised us how worth it the whole day was, even with a six hour flight and an hour drive down to Santa Clara.",
        "",
        "The Niners have the best tailgate in football, we got free tacos and tequila just for winning some trivia in the lot. Inside it is the most beautiful outdoor stadium in the NFL, great food, elite team. The one knock is the crowd can be quiet and not everyone stands, but the place itself is special. Put it on your list.",
      ].join('\n'),
    },
  },
  {
    id: '3798', name: 'Lambeau Field',
    tips: [
      ['before', "Before the game you get Titletown plus crawls and tailgates in people's actual backyards. There is no bad experience at Lambeau."],
      ['food', "Get the cheese curds and a Spotted Cow. We tasted them and they are genuinely delicious."],
      ['atmosphere', "You can feel the history, tradition, and love for the Packers in this place. If you love football, you have to make it to Lambeau once in your lifetime."],
      ['tips', "There is not much to do in Green Bay besides football, and honestly that is the point. Build the trip entirely around the game."],
    ],
    review: {
      rating: 9,
      body: [
        "Lambeau is the mecca of football experiences and our number one of the entire season.",
        "",
        "Before the game you get Titletown plus crawls and tailgates in people's actual backyards, and there is genuinely no bad experience here. Get the cheese curds and a Spotted Cow, both delicious. Inside you can feel the history and the love for the Packers in a way no other building has. There is not much to do in Green Bay besides football, which is exactly why a Packers game is bucket list. If you love football, get here once in your life.",
      ].join('\n'),
    },
  },
  {
    id: '3719', name: 'Northwest Stadium',
    tips: [
      ['food', "Surprisingly, the Commanders had the best stadium food of our entire NFL season. The crab egg rolls and the cheesesteak are the move."],
      ['getting-there', "There was basically no one tailgating, so do not count on a big pregame scene here."],
      ['tips', "If you get free tickets you should probably go, but it is not a destination on its own. The food is the highlight."],
    ],
    review: null,
  },
  {
    id: '3493', name: 'Caesars Superdome',
    tips: [
      ['before', "No tailgating, but the pregame is the coolest in the league. A massive open courtyard stocked with bars and live music, plus Bourbon Street steps away."],
      ['best-seats', "After the renovations the Superdome is easy to navigate. If you have a few extra bucks, sit down below rather than up top, it makes a big difference."],
      ['food', "The food is genuinely unique. Try the alligator hot dog."],
      ['tips', "Spend an extra day in New Orleans for the food and culture. A Saints game is bucket list, and a playoff game would be unreal."],
    ],
    review: {
      rating: 9,
      body: [
        "The Superdome is a bucket-list experience, our number three of the season.",
        "",
        "There is no tailgating, which sounds strange, but the pregame is the coolest in the league, a huge open courtyard with bars and live music and Bourbon Street right there. After the renovations the building is easy to get around, the entertainment and environment are top notch, and the food is genuinely unique, get the alligator hot dog. My one tip, sit down below instead of up top if you can swing it, it makes a real difference. Spend an extra day in Nola for the food and culture and you have a perfect trip.",
      ].join('\n'),
    },
  },
  {
    id: '3883', name: 'Highmark Stadium',
    tips: [
      ['atmosphere', "Bills fans are die-hard and the passion is real, but our hot take is that the hammer lot tailgate is a bit overrated."],
      ['food', "The food is miserable. Do not get the fries, they were a 0 out of 10."],
      ['getting-there', "You are essentially in a suburb of upstate New York, and getting out of Orchard Park is a genuine nightmare."],
    ],
    review: null,
  },
  {
    id: '3814', name: 'M&T Bank Stadium',
    tips: [
      ['atmosphere', "A Ravens night game is one of the loudest atmospheres anywhere. Mahomes himself said the only places he has had to go silent count are Baltimore and Seattle."],
      ['before', "The tailgate scene is strong. We have thrown 300 person tailgates here and the Ravens flock shows out."],
      ['tips', "If you can, get a night game. A Blackout at the Bank is the version that teeters between A-tier and bucket list."],
    ],
    review: {
      rating: 8,
      body: [
        "Any Ravens game is a great time, but a night game at M&T Bank is something else, easily A-tier and teetering on bucket list.",
        "",
        "The atmosphere is one of the loudest anywhere, Mahomes himself said the only places he has had to go silent count are Baltimore and Seattle. The flock shows out and the tailgate scene is strong, we have thrown 300 person tailgates here. If you can pick, get a Blackout night game, that is the version worth flying in for.",
      ].join('\n'),
    },
  },
  {
    id: '6501', name: 'Allegiant Stadium',
    tips: [
      ['best-seats', "Allegiant is a beautiful stadium and it hosted a Super Bowl. The games here tend to be high scoring, we caught an 84 point shootout."],
      ['tips', "Vegas can be the best or the worst weekend of your life, and that has nothing to do with the game. This is the highest-variance trip on the list, it depends on how you do at the casino."],
    ],
    review: null,
  },
  {
    id: '7065', name: 'SoFi Stadium',
    tips: [
      ['best-seats', "SoFi is a stunning stadium, genuinely one of the nicest you will see. The catch is it is nearly impossible to navigate."],
      ['atmosphere', "The atmosphere is underwhelming. The crowd noise is largely pumped in and you can end up surrounded by the visiting team fans."],
      ['tips', "There is nothing super special about the Rams experience itself. LA is amazing but it is not really a football town. Go if you get free tickets."],
    ],
    review: null,
  },
  {
    id: '3679', name: 'Huntington Bank Field',
    tips: [
      ['before', "Hit the Muni Lot for some solid tailgating and genuinely wild costumes."],
      ['food', "The food inside is surprisingly tasty, and the fans are very passionate."],
      ['tips', "Two cautions, be ready for some grown men barking at you, and dress warm, it is on the water and gets very chilly. Cleveland as a city is wildly underrated."],
    ],
    review: null,
  },
  {
    id: '1841', name: 'crypto.com Arena',
    tips: [
      ['best-seats', "Almost every seat is a good seat here. We sat in section 333 row 8 worried about the view, and it was great."],
      ['food', "Try the carne asada fries, a solid stadium dish at about a 7. The LA street tacos are good too, a touch light on the cheese."],
      ['atmosphere', "The arena is gorgeous and iconic, but the atmosphere can be lacking, lots of casual fans and a slow-to-fill crowd on weeknights."],
    ],
    review: null,
  },
  {
    id: '1830', name: 'Madison Square Garden',
    tips: [
      ['food', "MSG has the best stadium food in America. Get the chop cheese from the new bodega stand, an 8.5. The pizza is fine but not the city's best slice."],
      ['atmosphere', "Knicks fans are a tier above, they will celebrate a playoff series like they won a title. The padded seats are a nice touch."],
      ['getting-there', "Take the subway or walk, it is a huge money saver versus an expensive, traffic-heavy drive to most arenas."],
      ['tips', "Tickets and food at MSG are pricey, that is the one knock. Everything else is elite."],
      ['atmosphere', "The atmosphere can be a 10. Fans were on Embiid all night and even got him a technical, and the late pop moment when the whole arena erupts is unreal. The Knicks fans genuinely carry the team."],
      ['before', "There is a real ritual to it, even a prayer circle before the game. After a win the crowd floods the streets and the party spills onto Seventh Avenue."],
    ],
    review: {
      rating: 8,
      body: [
        "MSG lives up to the billing. The food is the best in America, no contest, get the chop cheese from the new bodega stand, it is an 8.5, and even the pizza is solid.",
        "",
        "Knicks fans are a tier above, they will celebrate a playoff series like they won a title, and the padded seats are a nice touch. Getting there is easy and cheap if you take the subway or walk. The only real knock is the prices, tickets and concessions are steep. Iconic building, easily worth it.",
      ].join('\n'),
    },
  },
  {
    id: '1845', name: 'Xfinity Mobile Arena (76ers)',
    tips: [
      ['before', "The pregame setup is the coolest in sports. Wells Fargo, Lincoln Financial where the Eagles play, and the Phillies park are all in one complex. Inside there is a bar with big screens, cheesesteaks and pizza where you can watch the game if you cannot get a ticket."],
      ['food', "Get the Philly cheesesteak, it is fantastic, an 8.5. Their pizza slice is even better than New York. The arena food over-delivers."],
      ['atmosphere', "Sixers fans bring real edge and never disappoint, but do not let the away team take over your building. There is an underlying respect between Sixers and Knicks fans."],
      ['best-seats', "Wells Fargo is newer than MSG with a slightly nicer concourse, but the seats themselves are nothing special, about a 7."],
    ],
    review: {
      rating: 7,
      body: [
        "Philly might have the coolest pregame setup in all of sports. Wells Fargo, the Eagles stadium, and the Phillies park are all in one complex, and inside there is a bar with big screens and cheesesteaks where you can watch the game even if you cannot get a ticket.",
        "",
        "The cheesesteak is fantastic, an 8.5, and honestly their pizza slice beats New York. The arena is newer than MSG with a nicer concourse, though the seats are nothing special. The one knock the night we went, the home crowd let the away fans take over, which is the worst thing a fan base can do. Still a great experience and a can't-miss if you get a playoff game.",
      ].join('\n'),
    },
  },
  {
    id: '1824', name: 'TD Garden',
    tips: [
      ['food', "Boston does food right. The fish is the best we have had at an arena, and the pizza is huge with a Chuck-E-Cheese vibe, which is a compliment, maybe the best arena pizza we have had. Food is a 7.5."],
      ['best-seats', "Courtside is unreal if you can swing it. The concourse and the seats are genuinely nice, this is a clean, well-run building."],
      ['atmosphere', "The crowd stays loud the entire game even in a blowout, and it is electric. Some of us called it the most electric place we have ever been, even over MSG. The city is lit after a win."],
    ],
    review: {
      rating: 8,
      body: [
        "TD Garden is a real basketball cathedral and our very close number two for NBA playoff experiences.",
        "",
        "The crowd stays loud the whole game even in a blowout, and a couple of us called it the most electric place we have ever been, even over MSG. The food is a genuine surprise, the fish is the best we have had at an arena and the pizza is huge and great, a Chuck-E-Cheese vibe in the best way. The concourse and seats are nice, and if you can ever get courtside for a playoff game it is a 9.5 night. Boston after a win is lit. Easily a can't-miss.",
      ].join('\n'),
    },
  },
  {
    id: '1827', name: 'State Farm Arena',
    tips: [
      ['tips', "The most unique thing in the building is a real barber shop where you can get a haircut during the game. We have never seen another arena with one, and they even had exclusive Jeff Hamilton Hawks jackets."],
      ['food', "Food over-delivers. The concessions are all local Atlanta restaurants instead of generic chains, and the half slab of baby back ribs off an open-fire grill was one of the best stadium food items we have ever had, a 7, same as the Chiefs."],
      ['food', "Get the lemon pepper wings, it is an Atlanta thing, shout out Lou Will, just know they run small."],
      ['best-seats', "Stunning arena after the 2019 renovations with beautiful padded seats. The stadium itself is the highlight and carries the score."],
      ['atmosphere', "Atmosphere can be thin. We were told it was a sellout and it looked half empty with only a few rows in the fan section, but that was a midweek game with the Hawks resting starters against a bottom team. The fans we met were die-hards."],
      ['getting-there', "Mercedes-Benz Stadium where the Falcons play is a stone's throw away, so you are right in the middle of the Atlanta sports district."],
    ],
    review: {
      rating: 5,
      body: [
        "State Farm Arena is genuinely nice, the 2019 renovations make it a stunning building with great padded seats, and it has the most unique feature we have seen anywhere, an actual barber shop where you can get a haircut during the game.",
        "",
        "The food over-delivers too, all local Atlanta spots instead of generic chains, and the open-fire ribs were one of the best arena items we have ever had. The catch is the atmosphere. We were told it was a sellout and it looked half empty, but to be fair it was a midweek game with the Hawks resting starters against the worst team in the league. The fans we talked to were die-hards even though the online world treats the Hawks as the most hated team in the NBA, mostly over their against-the-spread betting record. Solid stadium, mid everything else, worth it on a big night.",
      ].join('\n'),
    },
  },
  {
    id: '43', name: 'Oracle Park',
    tips: [
      ['tips', "The signature move here is McCovey Cove. Rent a kayak at Pier 40 and paddle out behind the stadium to try to catch a splash-hit home run. There have been 103 splash hits and only lefties have ever managed one, so watch the lineup. Bring friends and beers and do it once."],
      ['best-seats', "Oracle Park is as close to a perfect stadium as we have seen. It is luxurious and right on the water but still feels like a real ballpark, with green seats like Camden Yards. The Field Club behind home plate is incredible, and there is a Kid Zone and tons of features."],
      ['food', "The food might be the best in baseball. The crazy crab sandwich, the SoDo pastrami, and especially the caramel popcorn are unreal, possibly the best single item we have ever had at a stadium."],
      ['atmosphere', "Fans are great and genuinely friendly, the cove crowd will hand you food, drinks, and sunscreen. It was not super rowdy the day we went, but a Giants playoff game would be loud."],
      ['getting-there', "Stay near the ballpark, not downtown. The area right around Oracle Park and the cove is beautiful with bars outside, but skip lodging near Capitol Hill or City Hall."],
    ],
    review: {
      rating: 8,
      body: [
        "Oracle Park is one of the best ballparks in the country, the stadium itself is about as close to a 10 as we have ever scored one. It sits right on the water, feels luxurious but still like a real ballpark, green seats like Camden Yards.",
        "",
        "The food is elite, the crab sandwich, the pastrami, and a caramel popcorn that might be the single best thing we have ever eaten at a stadium. The one-of-a-kind move is McCovey Cove, rent a kayak at Pier 40 and try to catch a splash-hit home run, it is a 9-plus for uniqueness, just know only lefties ever hit one out there and you will not actually watch much of the game.",
        "",
        "Fans are friendly and the area around the park is great, just do not stay downtown near City Hall. A Giants game here is a must, and a playoff game would be even better.",
      ].join('\n'),
    },
  },
]

const SCOPE = 'venue'
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const idFor = (venueId, section, body) => createHash('sha256').update(`${SCOPE}|${venueId}|${section}|${body}`).digest('hex').slice(0, 24)
const ts = new Date().toISOString()

const lines = [
  '-- Snapback official gameday tips + reviews for every venue Snapback has visited.',
  '-- Sourced from Snapback videos. Editorial, attributed to the official Snapback account.',
  '-- Generated by scripts/seed-snapback-tips.mjs, do not hand-edit.',
  'PRAGMA foreign_keys=OFF;',
  'BEGIN TRANSACTION;',
  'DELETE FROM tips;',
  "DELETE FROM reviews WHERE user_id = 'snapback-official';",
  // Author-only account (never signs in) — Better Auth columns, no password.
  `INSERT OR IGNORE INTO users (id,email,username,display_username,display_name,email_verified,created_at,updated_at) VALUES (${q(OFFICIAL.id)},${q(OFFICIAL.email)},${q(OFFICIAL.username.toLowerCase())},${q(OFFICIAL.username)},${q(OFFICIAL.author)},1,${q(ts)},${q(ts)});`,
]
// Venues extracted from the full transcript archive (parallel agents -> consolidate).
const GEN = JSON.parse(readFileSync(path.join(ROOT, 'data', 'snapback-venues.generated.json'), 'utf8'))
let tipCount = 0
let reviewCount = 0
for (const v of [...VENUES, ...GEN]) {
  for (const [section, body] of v.tips) {
    lines.push(
      'INSERT OR REPLACE INTO tips (id,scope,target_id,section,user_id,author,body,created_at) VALUES (' +
        `${q(idFor(v.id, section, body))},${q(SCOPE)},${q(v.id)},${q(section)},${q(OFFICIAL.id)},${q(OFFICIAL.author)},${q(body)},${q(ts)});`,
    )
    tipCount++
  }
  if (v.review) {
    lines.push(
      'INSERT OR REPLACE INTO reviews (id,scope,target_id,game_id,user_id,author,rating,body,created_at) VALUES (' +
        `${q('snapback-review-' + v.id)},${q(SCOPE)},${q(v.id)},NULL,${q(OFFICIAL.id)},${q(OFFICIAL.author)},${v.review.rating},${q(v.review.body)},${q(ts)});`,
    )
    reviewCount++
  }
}
lines.push('COMMIT;', '')

writeFileSync(OUT, lines.join('\n'))
process.stderr.write(`Wrote ${tipCount} tips + ${reviewCount} reviews across ${VENUES.length + GEN.length} venues -> ${path.relative(ROOT, OUT)}\n`)
