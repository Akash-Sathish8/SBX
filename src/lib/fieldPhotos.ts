// Field-report photos attached to fan reviews, keyed by venue id -> author
// username (lowercased). Static assets under public/img/reports/. Photos are
// grouped by category in the Fan Reviews card (order here = display order);
// 'area' is the little yellow tag on each thumb. Curated set: unclear shots
// deleted, duplicate clusters collapsed to one best frame (64 -> 27).

export interface FieldPhoto {
  src: string
  area: string
  category: string
}

export const FIELD_PHOTOS: Record<string, Record<string, FieldPhoto[]>> = {
  // Citi Field
  '209': {
    robby: [
    { src: "/img/reports/citi/robby/r01.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r25.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r26.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r30.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r33.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r34.jpg", area: "Food", category: "Food" },
    { src: "/img/reports/citi/robby/r38.jpg", area: "Menus", category: "Food" },
    { src: "/img/reports/citi/robby/r10.jpg", area: "100 Level", category: "Views" },
    { src: "/img/reports/citi/robby/r40.jpg", area: "300 Level", category: "Views" },
    { src: "/img/reports/citi/robby/r56.jpg", area: "400 Level", category: "Views" },
    { src: "/img/reports/citi/robby/r02.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r12.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r14.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r15.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r17.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r18.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r19.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r20.jpg", area: "Concourse", category: "Stadium" },
    { src: "/img/reports/citi/robby/r04.jpg", area: "Team Store", category: "Stadium" },
    { src: "/img/reports/citi/robby/r63.jpg", area: "Team Store", category: "Stadium" },
    { src: "/img/reports/citi/robby/r59.jpg", area: "Outside", category: "Stadium" },
    { src: "/img/reports/citi/robby/r44.jpg", area: "Heineken Lounge", category: "Lounges" },
    { src: "/img/reports/citi/robby/r45.jpg", area: "Heineken Lounge", category: "Lounges" },
    { src: "/img/reports/citi/robby/r49.jpg", area: "Heineken Lounge", category: "Lounges" },
    { src: "/img/reports/citi/robby/r51.jpg", area: "Heineken Lounge", category: "Lounges" },
    { src: "/img/reports/citi/robby/r57.jpg", area: "Whiskey Club", category: "Lounges" },
    { src: "/img/reports/citi/robby/r64.jpg", area: "Freebie", category: "Freebie" },
    ],
  },
}
