import { App, Button, Descriptions, Form, Input } from 'antd';
import { AUTH_POLICY, auditChannelText, listTime, type Profile } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { RequestError } from '../../components/RequestError';
import { identityCopy as t } from './copy';
import { useProfileSave } from './queries';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';

export function ProfileCard({ profile }: { profile: Profile }) {
  const save = useProfileSave();
  const lock = useSubmitLock();
  const { message } = App.useApp();
  async function submit(values: { displayName: string }) {
    try {
      await save.mutateAsync(values.displayName.trim());
      void message.success(t.saved);
    } catch {
      /* The inline request error retains safe retry context. */
    }
  }
  return (
    <Card title={t.profile}>
      <Descriptions
        column={1}
        items={[
          { key: 'username', label: t.username, children: profile.username },
          { key: 'channel', label: t.channel, children: auditChannelText(profile.channel) },
          {
            key: 'last',
            label: t.lastLogin,
            children: profile.lastLoginAt ? listTime(profile.lastLoginAt) : t.unknown,
          },
          { key: 'expires', label: t.expires, children: listTime(profile.expiresAt) },
          {
            key: 'changed',
            label: t.passwordChanged,
            children: profile.passwordChangedAt ? listTime(profile.passwordChangedAt) : t.unknown,
          },
        ]}
      />
      <Form
        layout="vertical"
        initialValues={{ displayName: profile.displayName ?? '' }}
        onFinish={(values) => lock.run(() => submit(values))}
      >
        <Form.Item name="displayName" label={t.displayName} extra={t.displayHint}>
          <Input maxLength={AUTH_POLICY.displayNameMaxLength} autoComplete="nickname" />
        </Form.Item>
        {save.error && <RequestError error={save.error} />}
        <Button htmlType="submit" {...lock.button}>
          {t.save}
        </Button>
      </Form>
    </Card>
  );
}
