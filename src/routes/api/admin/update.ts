import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { withAdmin } from '@/lib/auth';
import {
  setMatchResult,
  setMatchOverride,
  setPositionOverride,
  clearPositionOverride,
  setSpend,
  setYouTubeId,
  setStadiumOverride,
  setVisibilityFlags,
  setUnderdogReferral,
  bumpDataVersion,
} from '@/lib/kv';

// ── Reusable field validators ────────────────────────────────────────────
// These fields are rendered back into the public page (image src, anchor href,
// iframe src), so validate them as data-integrity AND a defense against
// injecting a `javascript:` URL or arbitrary markup via the admin API.
const matchNumber = z.number().int().nonnegative();
const safeImageRef = z
  .string()
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/'), {
    message: 'must be empty, an http(s) URL, or a root-relative path',
  });
const httpUrlOrEmpty = z
  .string()
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'must be empty or an http(s) URL',
  });
const youTubeId = z.string().regex(/^[A-Za-z0-9_-]{6,20}$/, 'invalid YouTube id');

const matchResultSchema = z.object({
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  status: z.enum(['scheduled', 'live', 'final', 'postponed', 'cancelled']),
  notes: z.string().nullable(),
  updatedAt: z.string().optional(),
});

const matchFieldOverrideSchema = z
  .object({
    match: z.string().optional(),
    homeTeam: z.string().optional(),
    awayTeam: z.string().optional(),
    stadiumId: z.string().optional(),
    kickoffLocal: z.string().optional(),
    kickoffTZ: z.string().optional(),
    sleepCity: z.string().optional(),
    sleepLat: z.number().optional(),
    sleepLng: z.number().optional(),
    notes: z.string().nullable().optional(),
    betSlipImage: safeImageRef.optional(),
    agenda: z.string().optional(),
  })
  .strict();

const positionOverrideSchema = z
  .object({
    active: z.boolean(),
    stadiumId: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    description: z.string().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .strict();

const spendTrackerSchema = z
  .object({
    budgetTotal: z.number(),
    travelBudget: z.number(),
    ticketsBudget: z.number(),
    incidentalsBudget: z.number(),
    travelActual: z.number(),
    ticketsActual: z.number(),
    incidentalsActual: z.number(),
    lineItems: z
      .array(
        z.object({
          category: z.enum(['travel', 'tickets', 'incidentals']),
          label: z.string(),
          amount: z.number(),
          notes: z.string().optional(),
        }),
      )
      .optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

// Per-action payload schemas. Adding a new action requires a schema here, so an
// unvalidated write can't slip through.
const actionSchemas = {
  'set-result': z.object({ matchNumber, result: matchResultSchema }),
  'bulk-set-results': z.object({
    entries: z.array(z.object({ matchNumber, result: matchResultSchema })),
  }),
  'set-match-fields': z.object({ matchNumber, fields: matchFieldOverrideSchema }),
  'set-position-override': positionOverrideSchema,
  'clear-position-override': z.unknown(),
  'set-spend': spendTrackerSchema,
  'set-youtube': z.object({ matchNumber, youtubeId: youTubeId }),
  'set-stadium-hero': z.object({ stadiumId: z.string().min(1), heroImage: safeImageRef }),
  'set-visibility': z.object({
    showLodging: z.coerce.boolean(),
    showTransport: z.coerce.boolean(),
  }),
  'set-underdog-referral': z.object({ url: httpUrlOrEmpty }),
} satisfies Record<string, z.ZodTypeAny>;

type Action = keyof typeof actionSchemas;

export const Route = createFileRoute('/api/admin/update')({
  server: {
    handlers: {
      POST: withAdmin(async ({ request }) => {
        try {
          const body = (await request.json()) as { action?: string; payload?: unknown };
          const action = body?.action as Action | undefined;
          const schema = action ? actionSchemas[action] : undefined;
          if (!action || !schema) {
            return Response.json(
              { ok: false, error: `Unknown action: ${body?.action}` },
              { status: 400 },
            );
          }

          const parsed = schema.safeParse(body.payload);
          if (!parsed.success) {
            return Response.json(
              { ok: false, error: 'Invalid payload', issues: parsed.error.issues },
              { status: 400 },
            );
          }

          switch (action) {
            case 'set-result': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-result']>;
              await setMatchResult(p.matchNumber, p.result);
              break;
            }
            case 'bulk-set-results': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['bulk-set-results']>;
              for (const e of p.entries) await setMatchResult(e.matchNumber, e.result);
              break;
            }
            case 'set-match-fields': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-match-fields']>;
              await setMatchOverride(p.matchNumber, p.fields);
              break;
            }
            case 'set-position-override': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-position-override']>;
              await setPositionOverride(p);
              break;
            }
            case 'clear-position-override':
              await clearPositionOverride();
              break;
            case 'set-spend': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-spend']>;
              await setSpend(p);
              break;
            }
            case 'set-youtube': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-youtube']>;
              await setYouTubeId(p.matchNumber, p.youtubeId);
              break;
            }
            case 'set-stadium-hero': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-stadium-hero']>;
              await setStadiumOverride(p.stadiumId, { heroImage: p.heroImage });
              break;
            }
            case 'set-visibility': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-visibility']>;
              await setVisibilityFlags({
                showLodging: p.showLodging,
                showTransport: p.showTransport,
              });
              break;
            }
            case 'set-underdog-referral': {
              const p = parsed.data as z.infer<(typeof actionSchemas)['set-underdog-referral']>;
              await setUnderdogReferral(p.url);
              break;
            }
          }
          // Invalidate the public edge-cached snapshot so reads pick up the change.
          await bumpDataVersion();
          return Response.json({ ok: true });
        } catch (err) {
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      }),
    },
  },
});
