import { Alert, Col, Flex, Row, Skeleton } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@umijs/max';
import { PageShell } from '../../components/ui/PageShell';
import { RequestError } from '../../components/RequestError';
import { spacing } from '../../theme/design-tokens';
import { identityKeys } from './queries';
import { identityCopy as t } from './copy';
import { ProfileCard } from './profile';
import { PasswordCard } from './password';
import { SessionsCard } from './sessions';
import { LogoutCard } from './logout';

export function IdentityPage() {
  const profile = useQuery(identityKeys.profile);
  const { search } = useLocation();
  return (
    <PageShell title={t.title} description={t.description} icon={<UserOutlined />}>
      <Flex vertical gap={spacing[16]}>
        {new URLSearchParams(search).get('password') === 'required' && (
          <Alert type="warning" showIcon title={t.legacyPassword} />
        )}
        {profile.error && <RequestError error={profile.error} retry={() => profile.refetch()} />}
        {profile.isLoading && <Skeleton active />}
        {profile.data && (
          <>
            <Row gutter={[spacing[16], spacing[16]]}>
              <Col xs={24} lg={12}>
                <ProfileCard profile={profile.data} />
              </Col>
              <Col xs={24} lg={12}>
                <PasswordCard />
              </Col>
            </Row>
            <SessionsCard />
            <LogoutCard />
          </>
        )}
      </Flex>
    </PageShell>
  );
}
