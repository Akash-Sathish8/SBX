
import { useFollows } from '@/lib/follows';

interface Props {
  team: string;
  size?: number;
  className?: string;
}

// Small star toggle next to a team name. Hollow ☆ = not following;
// filled ★ in yellow = following. One tap to flip. Stops click
// propagation so tapping the star inside a card-wide button doesn't
// also fire the card's primary action.
export default function FollowStar({ team, size = 12, className = '' }: Props) {
  const { isFollowing, toggle } = useFollows();
  const on = isFollowing(team);

  if (!team || team === 'TBD') return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(team);
      }}
      className={`inline-flex items-center justify-center transition-colors leading-none ${
        on ? 'text-snap-yellow' : 'text-snap-fog hover:text-snap-yellow'
      } ${className}`}
      style={{ fontSize: size, width: size + 6, height: size + 6 }}
      aria-pressed={on}
      aria-label={on ? `Unfollow ${team}` : `Follow ${team}`}
      title={on ? `Unfollow ${team}` : `Follow ${team}`}
    >
      {on ? '★' : '☆'}
    </button>
  );
}
