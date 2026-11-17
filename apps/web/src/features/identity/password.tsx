import { useState } from 'react';
import { App, Button, Form, Input, Typography } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { passwordRuleError, type PasswordInput } from '@wms/contracts';
import { z } from 'zod';
import { request } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { RequestError } from '../../components/RequestError';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { identityCopy as t } from './copy';

type Values = PasswordInput & { confirmPassword: string };
export function PasswordCard() {
  const [form] = Form.useForm<Values>();
  const [error, setError] = useState<unknown>();
  const { modal } = App.useApp();
  const client = useQueryClient();
  const lock = useSubmitLock();
  async function submit(values: Values) {
    const confirmed = await modal.confirm({
      title: t.changeConfirm,
      content: t.changeDetail,
      okText: t.confirmChange,
      cancelText: t.cancel,
    });
    if (!confirmed) return;
    setError(undefined);
    try {
      // Keep credentials out of React Query's mutation cache and form drafts.
      await request('/me/password', z.null(), {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      });
      form.resetFields();
      client.clear();
      window.location.assign('/user/login?password=changed');
    } catch (cause) {
      form.resetFields();
      setError(cause);
    }
  }
  return (
    <Card title={t.password}>
      <Typography.Paragraph type="secondary">{t.passwordHint}</Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        clearOnDestroy
        onFinish={(values) => lock.run(() => submit(values))}
      >
        <PasswordFields />
        {error != null && <RequestError error={error} />}
        <Button type="primary" htmlType="submit" {...lock.button}>
          {lock.text(t.password)}
        </Button>
      </Form>
    </Card>
  );
}

function PasswordFields() {
  return (
    <>
      <Form.Item name="oldPassword" label={t.oldPassword} rules={[{ required: true, message: t.required }]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item
        name="newPassword"
        label={t.newPassword}
        extra={t.passwordRule}
        rules={[
          { required: true, message: t.required },
          {
            validator: (_, value: string | undefined) => {
              if (!value) return Promise.resolve();
              const error = passwordRuleError(value ?? '');
              return error ? Promise.reject(new Error(error)) : Promise.resolve();
            },
          },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        name="confirmPassword"
        label={t.confirmPassword}
        dependencies={['newPassword']}
        rules={[
          { required: true, message: t.required },
          ({ getFieldValue }) => ({
            validator: (_, value: string) =>
              value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error(t.mismatch)),
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
    </>
  );
}
