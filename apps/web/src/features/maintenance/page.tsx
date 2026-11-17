import { Tabs } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { PageShell } from '../../components/ui';
import { BackupTab } from './backup-tab';
import { HealthTab } from './health-tab';
import { maintenanceCopy as t } from './copy';

export function MaintenancePage() {
  return (
    <PageShell icon={<ToolOutlined />} title={t.title} description={t.description}>
      <Tabs
        destroyOnHidden
        defaultActiveKey="backup"
        items={[
          { key: 'backup', label: t.backup, children: <BackupTab /> },
          { key: 'health', label: t.health, children: <HealthTab /> },
        ]}
      />
    </PageShell>
  );
}
