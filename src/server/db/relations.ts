// Drizzle relations for the relational query builder (db.query.x.findMany({ with })).
// Only real key relationships are modelled. The polymorphic (scope, target_id) on
// tips / reviews / expert_notes points at EITHER a venue id OR a 'league:gameId'
// string, so it has no foreign key and stays resolved in app code — intentionally
// no relation here.
import { relations } from 'drizzle-orm'
import {
  user, session, account,
  userRankings, tips, tipVotes, reviews, reviewVotes, follows,
  venues, venueTeams, teams, conferences, conferenceTeams, games,
} from './schema'

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  rankings: many(userRankings),
  tips: many(tips),
  reviews: many(reviews),
  // Two edges to `follows` — disambiguated by relationName (see followsRelations).
  following: many(follows, { relationName: 'follower' }),
  followers: many(follows, { relationName: 'followee' }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const userRankingsRelations = relations(userRankings, ({ one }) => ({
  user: one(user, { fields: [userRankings.userId], references: [user.id] }),
}))

export const tipsRelations = relations(tips, ({ one, many }) => ({
  // `authorUser`, not `author` — `tips.author` is already a text column (display
  // name snapshot); a relation of the same name would collide in query results.
  authorUser: one(user, { fields: [tips.userId], references: [user.id] }),
  votes: many(tipVotes),
}))

export const tipVotesRelations = relations(tipVotes, ({ one }) => ({
  tip: one(tips, { fields: [tipVotes.tipId], references: [tips.id] }),
}))

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  // `authorUser`, not `author` — see tipsRelations (reviews.author is a column too).
  authorUser: one(user, { fields: [reviews.userId], references: [user.id] }),
  votes: many(reviewVotes),
}))

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  review: one(reviews, { fields: [reviewVotes.reviewId], references: [reviews.id] }),
}))

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(user, { fields: [follows.followerId], references: [user.id], relationName: 'follower' }),
  followee: one(user, { fields: [follows.followeeId], references: [user.id], relationName: 'followee' }),
}))

// Reference graph
export const venuesRelations = relations(venues, ({ many }) => ({
  venueTeams: many(venueTeams),
}))

export const venueTeamsRelations = relations(venueTeams, ({ one }) => ({
  venue: one(venues, { fields: [venueTeams.venueId], references: [venues.id] }),
  team: one(teams, { fields: [venueTeams.league, venueTeams.teamId], references: [teams.league, teams.id] }),
}))

export const teamsRelations = relations(teams, ({ many }) => ({
  venueTeams: many(venueTeams),
  conferenceTeams: many(conferenceTeams),
}))

export const conferencesRelations = relations(conferences, ({ many }) => ({
  conferenceTeams: many(conferenceTeams),
}))

export const conferenceTeamsRelations = relations(conferenceTeams, ({ one }) => ({
  conference: one(conferences, { fields: [conferenceTeams.league, conferenceTeams.conferenceId], references: [conferences.league, conferences.id] }),
  team: one(teams, { fields: [conferenceTeams.league, conferenceTeams.teamId], references: [teams.league, teams.id] }),
}))

export const gamesRelations = relations(games, ({ one }) => ({
  venue: one(venues, { fields: [games.venueId], references: [venues.id] }),
  homeTeam: one(teams, { fields: [games.league, games.homeTeamId], references: [teams.league, teams.id], relationName: 'homeTeam' }),
  awayTeam: one(teams, { fields: [games.league, games.awayTeamId], references: [teams.league, teams.id], relationName: 'awayTeam' }),
}))
