import { Link } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { identityKeys } from './queries';
import { identityCopy as t } from './copy';
import { componentSize } from '../../theme/design-tokens';

export function ProfileLink() {
  const session = useSession();
  const profile = useQuery({ ...identityKeys.profile, enabled: Boolean(session.data), retry: false });
  const name = profile.data?.displayName || profile.data?.username || t.title;
  return (
    <Link
      to="/me"
      title={name}
      style={{
        maxWidth: componentSize.identityName,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
      }}
    >
      {name}
    </Link>
  );
}
