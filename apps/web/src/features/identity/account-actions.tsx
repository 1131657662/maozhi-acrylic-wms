import { Flex } from 'antd';
import { LogoutButton } from '../auth/logout';
import { spacing } from '../../theme/design-tokens';
import { ProfileLink } from './profile-link';
import { identityCopy as t } from './copy';

export function AccountActions() {
  return (
    <Flex vertical gap={spacing[8]} style={{ width: '100%' }}>
      <span className="environment-label">{t.environment}</span>
      <Flex align="center" justify="space-between" gap={spacing[8]}>
        <ProfileLink />
        <LogoutButton />
      </Flex>
    </Flex>
  );
}
