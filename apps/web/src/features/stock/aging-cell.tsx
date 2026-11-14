import { WarningOutlined } from '@ant-design/icons';
import { theme, Tooltip } from 'antd';
import { tonnes, type StockAging } from '@wms/contracts';
import { stockPageCopy } from './stock-copy';

function AgingDetails({ agingBuckets, unagingGrams }: StockAging) {
  return (
    <div>
      {agingBuckets.map((grams, index) => (
        <div key={stockPageCopy.agingBands[index]}>
          {stockPageCopy.agingBands[index]}：{tonnes(grams)} {stockPageCopy.tonnes}
        </div>
      ))}
      <div>
        {stockPageCopy.unaging}：{tonnes(unagingGrams)} {stockPageCopy.tonnes}
      </div>
      <div>{stockPageCopy.agingBasis}</div>
    </div>
  );
}

export function StockAgingCell(props: StockAging) {
  const { token } = theme.useToken();
  const colors = [
    token.colorSuccess,
    token.colorPrimary,
    token.colorWarning,
    token.colorWarningActive,
    token.colorError,
  ];
  const aged = props.agingBuckets.reduce((sum, grams) => sum + grams, 0);
  return (
    <Tooltip title={<AgingDetails {...props} />} trigger={['hover', 'focus']}>
      <div
        tabIndex={0}
        data-testid="stock-aging"
        aria-label={stockPageCopy.aging}
        style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}
      >
        <div
          aria-hidden
          style={{
            display: 'flex',
            height: token.sizeXS,
            borderRadius: token.borderRadiusSM,
            overflow: 'hidden',
            background: token.colorFillSecondary,
          }}
        >
          {props.agingBuckets.map((grams, index) => (
            <span
              key={stockPageCopy.agingBands[index]}
              data-aging-band={index}
              style={{ width: aged ? `${(grams / aged) * 100}%` : 0, background: colors[index] }}
            />
          ))}
        </div>
        {props.unagingGrams !== 0 && (
          <span
            data-testid="stock-unaging"
            style={{
              color: token.colorWarningText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <WarningOutlined /> {stockPageCopy.unaging} {tonnes(props.unagingGrams)} {stockPageCopy.tonnes}
          </span>
        )}
      </div>
    </Tooltip>
  );
}
