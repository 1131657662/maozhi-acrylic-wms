import { ProForm, ProFormText, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import type { MasterCatalog } from '@wms/contracts';
import { MasterSelect } from './select';
import { masterCopy as t } from './copy';
export function MasterExtraFields({ catalog }: { catalog: MasterCatalog }) {
  return (
    <>
      {catalog === 'products' && (
        <>
          <ProFormText name="model" label={t.model} />
          <ProForm.Item
            name="categoryCode"
            label={t.category}
            normalize={(value: string | undefined) => value ?? null}
            getValueProps={(value: string | null) => ({ value: value ?? undefined })}
          >
            <MasterSelect catalog="categories" />
          </ProForm.Item>
          {(['packageType', 'packageColor', 'strapColor'] as const).map((name) => (
            <ProFormText key={name} name={name} label={t[name]} />
          ))}
          <ProFormDigit name="minAlertTonnes" label={t.minAlertTonnes} min={0} fieldProps={{ precision: 4 }} />
          <ProFormDigit name="maxAlertTonnes" label={t.maxAlertTonnes} min={0} fieldProps={{ precision: 4 }} />
        </>
      )}
      {catalog === 'warehouses' &&
        (['contact', 'phone', 'address'] as const).map((name) => (
          <ProFormText key={name} name={name} label={t[name]} />
        ))}
      {catalog !== 'categories' && <ProFormTextArea name="memo" label={t.memo} fieldProps={{ maxLength: 500 }} />}
    </>
  );
}
