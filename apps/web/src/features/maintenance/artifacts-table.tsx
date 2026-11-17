import { useRef, useState } from 'react';
import { Button, Table } from 'antd';
import { MAINTENANCE, listTime, type BackupArtifact } from '@wms/contracts';
import { Card, SectionTitle } from '../../components/ui';
import { useArtifacts } from './hooks/use-artifacts';
import { useDownload } from './hooks/use-download';
import { MaintenanceError } from './error-notice';
import { maintenanceCopy as t } from './copy';
import { bytesText } from './presentation';
import { restoreCopy as r } from './restore-copy';

export function ArtifactsTable({
  version,
  restore,
  restoreDisabled,
}: {
  version: string;
  restore: (file: BackupArtifact) => void;
  restoreDisabled: boolean;
}) {
  const [page, setPage] = useState(1),
    downloading = useRef(false);
  const {
    data: artifacts,
    error: artifactsError,
    isLoading: loadingArtifacts,
    refetch: refreshArtifacts,
  } = useArtifacts(page, version);
  const {
    mutateAsync: download,
    error: downloadError,
    isPending: isDownloading,
    variables: downloadingId,
  } = useDownload();
  const save = async (id: string) => {
    if (downloading.current) return;
    downloading.current = true;
    try {
      await download(id);
    } catch {
      /* Render the safe download error below. */
    } finally {
      downloading.current = false;
    }
  };
  return (
    <Card title={<SectionTitle title={t.artifacts} />} testId="maintenance-artifacts">
      {artifactsError ? (
        <MaintenanceError error={artifactsError} retry={refreshArtifacts} />
      ) : (
        <Table<BackupArtifact>
          rowKey="id"
          loading={loadingArtifacts}
          dataSource={artifacts?.items ?? []}
          size="small"
          tableLayout="fixed"
          locale={{ emptyText: t.noArtifacts }}
          columns={[
            ...artifactColumns(save, isDownloading, downloadingId),
            {
              title: r.action,
              render: (_, file) => (
                <Button type="link" danger disabled={restoreDisabled} onClick={() => restore(file)}>
                  {r.action}
                </Button>
              ),
            },
          ]}
          pagination={{
            current: page,
            pageSize: MAINTENANCE.listLimit,
            total: artifacts?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
          }}
        />
      )}
      {downloadError && <MaintenanceError error={downloadError} />}
    </Card>
  );
}
function artifactColumns(save: (id: string) => Promise<void>, downloading: boolean, downloadingId?: string) {
  return [
    { title: t.created, dataIndex: 'createdAt', render: (value: string) => listTime(value) },
    { title: t.bytes, dataIndex: 'bytes', render: bytesText },
    { title: t.retentionClass, render: (_: unknown, file: BackupArtifact) => t.artifactType[file.retentionClass] },
    {
      title: t.sha,
      dataIndex: 'sha256',
      width: '35%',
      render: (value: string) => <span style={{ overflowWrap: 'anywhere' }}>{value}</span>,
    },
    {
      title: t.action,
      render: (_: unknown, file: BackupArtifact) => (
        <Button
          type="link"
          disabled={downloading}
          loading={downloading && downloadingId === file.id}
          onClick={() => void save(file.id)}
        >
          {t.download}
        </Button>
      ),
    },
  ];
}
