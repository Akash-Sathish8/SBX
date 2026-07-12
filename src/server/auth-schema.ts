// Drizzle schema for the Better Auth tables (D1/SQLite). Only auth code reads
// the DB through drizzle — the rest of the app keeps its raw prepared
// statements against the same tables (see src/server/db.ts).
//
// Property names ARE the Better Auth field names; the column strings map them
// onto our snake_case schema. `user` points at the pre-existing `users` table
// (extended by db/migrate-003-better-auth.sql) so every UGC table's
// users(id) foreign key and raw query keeps working untouched.
import { sqliteTable, text, integer, customType } from 'drizzle-orm/sqlite-core'

// Better Auth hands drizzle JS Date objects; every timestamp in this DB is an
// ISO-8601 TEXT column (lexicographic order == chronological, so SQL-side
// comparisons like "expires_at > now" stay correct). Bridge the two here.
const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => 'text',
  toDriver: (value: Date) => value.toISOString(),
  fromDriver: (value: string) => new Date(value),
})

export const user = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  // Better Auth's required `name` is our profile display_name — signup passes
  // the username as the initial name, and the profile editor PATCHes the same
  // column via raw SQL.
  name: text('display_name'),
  image: text('avatar'), // 'data:image/...', 'preset:N', or NULL — Google's picture URL is deliberately not written here (see mapProfileToUser)
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
  // username plugin: `username` is the normalized (lowercase) unique handle,
  // `displayUsername` preserves the case the fan typed.
  username: text('username').unique(),
  displayUsername: text('display_username'),
  // bio/favorites also live on this table but only raw-SQL profile code touches them.
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: isoDate('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
})

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
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: isoDate('expires_at').notNull(),
  createdAt: isoDate('created_at').notNull(),
  updatedAt: isoDate('updated_at').notNull(),
})
