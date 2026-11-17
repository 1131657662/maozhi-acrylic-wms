import { Alert, Button, theme } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { messageCopy as t } from '@wms/contracts';
import { PageShell, Card } from '../../components/ui';
import { MessageFilterBar } from './filters';
import { MessageResults } from './results';
import { useMessagePage } from './use-message-page';

export function MessagesPage() {
  const { token } = theme.useToken();
  const page = useMessagePage();
  return (
    <PageShell
      icon={<BellOutlined />}
      title={t.title}
      description={page.description}
      actions={
        <Button type="primary" loading={page.reading} disabled={page.disableAll} onClick={page.readAll}>
          {t.allRead}
        </Button>
      }
    >
      <Card>
        <MessageFilterBar filters={page.filters} onChange={page.setFilters} />
        {page.readError && (
          <Alert type="error" showIcon title={page.readError.message} style={{ marginBottom: token.margin }} />
        )}
        <MessageResults
          query={page.query}
          page={page.filters.page}
          busy={page.reading}
          onPage={page.changePage}
          onOpen={page.open}
        />
      </Card>
    </PageShell>
  );
}
