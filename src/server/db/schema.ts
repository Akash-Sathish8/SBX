// Unified Drizzle schema — the single source of truth for the whole D1 (SQLite)
// database. `drizzle-kit generate` reads this to author migrations, Better Auth
// reads the auth tables through it, and every app query runs against it. It
// faithfully reproduces db/schema.sql (which it replaces); column names/types,
// primary keys, and indexes match so the existing db/seed.*.generated.sql files
// still apply cleanly.
//
// Relations for the relational query builder live in ./relations.ts.
import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex, customType } from 'drizzle-orm/sqlite-core'

// Every timestamp Better Auth owns is a JS Date on the app side but an ISO-8601
// TEXT column in the DB (lexicographic order == chronological, so SQL-side
// "expires_at > now" comparisons stay correct). This bridges the two. App-owned
// tables keep their created_at/updated_at as plain text — the app already reads
// and writes them as ISO strings.
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value: Date) => value.toISOString(),
  fromDriver: (value: string) => new Date(value),
})

// ---------------------------------------------------------------------------
// Reference tables (ESPN ingest → system of record)
// ---------------------------------------------------------------------------
export const leagues = sqliteTable('leagues', {
  key: text('key').primaryKey(), // 'mlb' | 'nfl' | 'nba' | 'college-football' | ...
  label: text('label').notNull(),
  sport: text('sport').notNull(),
  espnPath: text('espn_path').notNull(),
})

export const teams = sqliteTable('teams', {
  league: text('league').notNull(),
  id: text('id').notNull(),
  abbr: text('abbr'),
  location: text('location'),
  name: text('name'),
  displayName: text('display_name'),
  color: text('color'),
  altColor: text('alt_color'),
  logo: text('logo'),
}, (t) => ({
  pk: primaryKey({ columns: [t.league, t.id] }),
}))

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  surface: text('surface'),
  indoor: integer('indoor'), // 0/1/NULL
  image: text('image'),
})

export const venueTeams = sqliteTable('venue_teams', {
  venueId: text('venue_id').notNull(),
  league: text('league').notNull(),
  teamId: text('team_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.venueId, t.league, t.teamId] }),
  byVenue: index('idx_venue_teams_venue').on(t.venueId),
}))

export const games = sqliteTable('games', {
  league: text('league').notNull(),
  id: text('id').notNull(),
  date: text('date').notNull(), // ISO timestamp
  season: integer('season'),
  seasonType: integer('season_type'), // 1=pre 2=regular 3=post
  state: text('state'), // 'pre' | 'in' | 'post'
  detail: text('detail'),
  completed: integer('completed'), // 0/1
  name: text('name'),
  shortName: text('short_name'),
  venueId: text('venue_id'),
  venueName: text('venue_name'),
  venueCity: text('venue_city'),
  venueState: text('venue_state'),
  homeTeamId: text('home_team_id'),
  homeAbbr: text('home_abbr'),
  homeLocation: text('home_location'),
  homeName: text('home_name'),
  homeDisplay: text('home_display'),
  homeColor: text('home_color'),
  homeLogo: text('home_logo'),
  homeScore: integer('home_score'),
  homeWinner: integer('home_winner'),
  awayTeamId: text('away_team_id'),
  awayAbbr: text('away_abbr'),
  awayLocation: text('away_location'),
  awayName: text('away_name'),
  awayDisplay: text('away_display'),
  awayColor: text('away_color'),
  awayLogo: text('away_logo'),
  awayScore: integer('away_score'),
  awayWinner: integer('away_winner'),
  updatedAt: text('updated_at'),
}, (t) => ({
  pk: primaryKey({ columns: [t.league, t.id] }),
  byDate: index('idx_games_date').on(t.date),
  byLeagueDate: index('idx_games_league_date').on(t.league, t.date),
  byState: index('idx_games_state').on(t.state),
  byVenue: index('idx_games_venue').on(t.venueId),
  byHomeTeam: index('idx_games_home_team').on(t.league, t.homeTeamId),
}))

export const conferences = sqliteTable('conferences', {
  league: text('league').notNull(),
  id: text('id').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  sort: integer('sort'),
}, (t) => ({
  pk: primaryKey({ columns: [t.league, t.id] }),
}))

export const conferenceTeams = sqliteTable('conference_teams', {
  league: text('league').notNull(),
  conferenceId: text('conference_id').notNull(),
  teamId: text('team_id').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.league, t.conferenceId, t.teamId] }),
  byConf: index('idx_conf_teams').on(t.league, t.conferenceId),
}))

// ---------------------------------------------------------------------------
// Auth tables — Better Auth owns users/session/account/verification. Property
// names ARE the Better Auth field names (id, email, name, image, emailVerified,
// createdAt, updatedAt, username, displayUsername); the column strings map them
// onto our snake_case schema. `users` also carries app-only profile columns
// (bio, favorites) that Better Auth ignores.
// ---------------------------------------------------------------------------
export const user = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  // Better Auth's required `name` is our profile display_name — signup passes the
  // username as the initial name; the profile editor PATCHes the same column.
  name: text('display_name'),
  image: text('avatar'), // 'data:image/...', 'preset:N', or NULL — Google's picture URL is deliberately not written here
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
  // username plugin: normalized (lowercase) unique handle + case-preserved display.
  username: text('username'),
  displayUsername: text('display_username'),
  // App-only profile columns (Better Auth never touches these).
  bio: text('bio'),
  favorites: text('favorites'), // JSON array of up to 4 favorite venue ids
}, (t) => ({
  emailUniq: uniqueIndex('idx_users_email').on(t.email),
  // Case-insensitive uniqueness backstop ("CoolGuy" vs "coolguy"). NULLs stay
  // distinct in SQLite, so OAuth users without a handle don't collide.
  usernameUniq: uniqueIndex('idx_users_username').on(sql`${t.username} COLLATE NOCASE`),
}))

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  token: text('token').notNull(),
  expiresAt: isoDate('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
}, (t) => ({
  tokenUniq: uniqueIndex('idx_session_token').on(t.token),
  byUser: index('idx_session_user').on(t.userId),
}))

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  accountId: text('account_id').notNull(), // provider's user id; equals user.id for 'credential'
  providerId: text('provider_id').notNull(), // 'credential' | 'google'
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: isoDate('access_token_expires_at'),
  refreshTokenExpiresAt: isoDate('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'), // pbkdf2 hash for 'credential' accounts (see password.ts)
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
}, (t) => ({
  byUser: index('idx_account_user').on(t.userId),
  byProvider: index('idx_account_provider').on(t.providerId, t.accountId),
}))

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: isoDate('expires_at').notNull(),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
}, (t) => ({
  byIdentifier: index('idx_verification_identifier').on(t.identifier),
}))

// ---------------------------------------------------------------------------
// UGC tables
// ---------------------------------------------------------------------------
export const userRankings = sqliteTable('user_rankings', {
  userId: text('user_id').notNull().references(() => user.id),
  gameId: text('game_id').notNull(),
  league: text('league').notNull(),
  away: text('away').notNull(),
  home: text('home').notNull(),
  awayLogo: text('away_logo'),
  homeLogo: text('home_logo'),
  date: text('date').notNull(),
  venue: text('venue').notNull(),
  venueId: text('venue_id'), // the game's venue id — fan scores aggregate by this (name is the legacy fallback)
  city: text('city'),
  fans: real('fans').notNull(),
  food: real('food').notNull(),
  unique_: real('unique_').notNull(), // `unique` is a SQL keyword
  stadium: real('stadium').notNull(),
  score: real('score').notNull(),
  ts: integer('ts').notNull(), // ms — merge tie-break
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.gameId] }),
  byUser: index('idx_user_rankings_user').on(t.userId),
  byVenueId: index('idx_user_rankings_venue_id').on(t.venueId),
  byVenue: index('idx_user_rankings_venue').on(t.venue),
}))

export const tips = sqliteTable('tips', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(), // 'venue' | 'event'
  targetId: text('target_id').notNull(), // venue id, or 'league:gameId'
  section: text('section').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  author: text('author').notNull(),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  byTarget: index('idx_tips_target').on(t.scope, t.targetId),
}))

export const tipVotes = sqliteTable('tip_votes', {
  tipId: text('tip_id').notNull().references(() => tips.id),
  userId: text('user_id').notNull(), // user id, or 'anon:<device-id>'
  vote: integer('vote').notNull(), // 1 = up, -1 = down
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.tipId, t.userId] }),
  byTip: index('idx_tip_votes_tip').on(t.tipId),
}))

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(),
  targetId: text('target_id').notNull(),
  gameId: text('game_id'),
  userId: text('user_id').notNull().references(() => user.id),
  author: text('author').notNull(),
  rating: integer('rating'), // optional overall 1-10
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  byTarget: index('idx_reviews_target').on(t.scope, t.targetId),
}))

export const reviewVotes = sqliteTable('review_votes', {
  reviewId: text('review_id').notNull().references(() => reviews.id),
  userId: text('user_id').notNull(),
  vote: integer('vote').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.reviewId, t.userId] }),
  byReview: index('idx_review_votes_review').on(t.reviewId),
}))

// Snapback editorial notes — NOT user UGC (deliberately no users FK).
export const expertNotes = sqliteTable('expert_notes', {
  id: text('id').primaryKey(), // deterministic hash of target+section+body
  scope: text('scope').notNull(),
  targetId: text('target_id').notNull(),
  section: text('section').notNull(),
  body: text('body').notNull(),
  sourceUrl: text('source_url'),
  sourceQuote: text('source_quote'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  byTarget: index('idx_expert_notes_target').on(t.scope, t.targetId),
}))

export const assistantUsage = sqliteTable('assistant_usage', {
  userId: text('user_id').notNull(),
  bucket: text('bucket').notNull(), // ISO hour, e.g. '2026-06-21T18'
  count: integer('count').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.bucket] }),
}))

export const follows = sqliteTable('follows', {
  followerId: text('follower_id').notNull().references(() => user.id),
  followeeId: text('followee_id').notNull().references(() => user.id),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.followerId, t.followeeId] }),
  byFollowee: index('idx_follows_followee').on(t.followeeId),
}))
