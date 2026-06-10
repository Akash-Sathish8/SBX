import { createFileRoute } from '@tanstack/react-router';
import { getVisibilityFlags } from '@/lib/kv';

export const Route = createFileRoute('/api/visibility')({
  server: {
    handlers: {
      GET: async () => {
        const flags = await getVisibilityFlags();
        return Response.json(flags, {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
      },
    },
  },
});
