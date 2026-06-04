import { createFileRoute, Outlet } from '@tanstack/react-router';

// Layout route for /casey/*. In TanStack flat routing this is the PARENT of
// casey.index (the tracker), casey.admin, and casey.match.$number — so it must
// render an <Outlet/> for those children. (Previously it rendered the tracker
// directly with no Outlet, which made /casey/admin and /casey/match/* fall
// through to the tracker instead of their own components.)
export const Route = createFileRoute('/casey')({
  component: () => <Outlet />,
});
