import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space } from 'antd';
import { useState } from 'react';
import type { ListView } from './use-list-views';
import { Toolbar } from '../ui';

interface Props {
  views: ListView[];
  apply: (view: ListView) => void;
  save: (name: string) => void;
  remove: (name: string) => void;
  design?: boolean;
}

export function ListViewToolbar({ views, apply, save, remove, design = false }: Props) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string>();
  const canSave = name.trim().length > 0;
  const selectedView = views.find((view) => view.name === selected);
  const controls = (
    <>
      <Select
        allowClear
        aria-label="已保存视图"
        placeholder="选择已保存视图"
        value={selected}
        options={views.map((view) => ({ value: view.name, label: view.name }))}
        onChange={(value) => {
          setSelected(value);
          if (value) {
            const view = views.find((item) => item.name === value);
            if (view) apply(view);
          }
        }}
        style={{ minWidth: 180 }}
      />
      <Input
        aria-label="视图名称"
        placeholder="视图名称"
        value={name}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        style={{ width: 150 }}
      />
      <Button
        icon={<SaveOutlined />}
        disabled={!canSave}
        onClick={() => {
          save(name);
          setSelected(name.trim());
          setName('');
        }}
      >
        保存视图
      </Button>
      <Button
        icon={<DeleteOutlined />}
        danger
        disabled={!selectedView}
        onClick={() => {
          if (selectedView) {
            remove(selectedView.name);
            setSelected(undefined);
          }
        }}
      >
        删除视图
      </Button>
    </>
  );
  return design ? (
    <div aria-label="列表视图">
      <Toolbar>{controls}</Toolbar>
    </div>
  ) : (
    <Space wrap size="small" aria-label="列表视图">
      {controls}
    </Space>
  );
}
