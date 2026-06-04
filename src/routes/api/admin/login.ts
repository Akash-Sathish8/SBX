import { createFileRoute } from '@tanstack/react-router';
import {
  getAdminPassword,
  issueAdminToken,
  getAdminCookieMaxAge,
  buildAdminCookie,
} from '@/lib/auth';

export const Route = createFileRoute('/api/admin/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { password } = (await request.json()) as { password?: string };
          if (!password || password !== getAdminPassword()) {
            return Response.json({ ok: false, error: 'Invalid password' }, { status: 401 });
          }
          const token = await issueAdminToken();
          return Response.json(
            { ok: true },
            { headers: { 'Set-Cookie': buildAdminCookie(token, getAdminCookieMaxAge()) } },
          );
        } catch (err) {
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
      DELETE: async () => {
        return Response.json(
          { ok: true },
          { headers: { 'Set-Cookie': buildAdminCookie('', 0) } },
        );
      },
    },
  },
});
