import { useEffect, useLayoutEffect, useRef } from 'react';
import { Spin } from 'antd';
import { EmptyState } from './EmptyState';
import { init, type ChartOption } from './chart-runtime';
import { componentSize } from '../../theme/design-tokens';

interface ChartProps {
  option: ChartOption | null;
  state: 'ready' | 'loading' | 'empty' | 'error' | 'unverifiable';
  message: string;
  description: string;
  height?: number;
  onPointClick?: (event: { name: string; seriesIndex?: number; dataIndex?: number }) => void;
}

function useChart(option: ChartOption | null, onPointClick?: ChartProps['onPointClick']) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<ReturnType<typeof init> | null>(null);
  useLayoutEffect(() => {
    if (!container.current || !option) {
      instance.current?.clear();
      return;
    }
    instance.current ??= init(container.current, undefined, { renderer: 'canvas' });
    instance.current.setOption(option, { notMerge: true, lazyUpdate: false });
    instance.current.resize();
    instance.current.off('click');
    if (onPointClick)
      instance.current.on('click', (event) =>
        onPointClick({
          name: String(event.name ?? ''),
          seriesIndex: event.seriesIndex,
          dataIndex: event.dataIndex,
        }),
      );
  }, [option, onPointClick]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (container.current?.clientWidth) instance.current?.resize();
    });
    if (container.current) observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.current?.dispose();
      instance.current = null;
    };
  }, []);
  return container;
}

export function Chart({
  option,
  state,
  message,
  description,
  height = componentSize.reportChart,
  onPointClick,
}: ChartProps) {
  const container = useChart(state === 'ready' ? option : null, onPointClick);
  return (
    <div
      data-testid="chart"
      data-state={state}
      style={{ height, minWidth: 0, position: 'relative', overflow: 'hidden' }}
    >
      <div
        ref={container}
        role="img"
        aria-label={description}
        aria-hidden={state !== 'ready'}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          visibility: state === 'ready' ? 'visible' : 'hidden',
        }}
      />
      {state !== 'ready' && (
        <div
          role={state === 'error' ? 'alert' : 'status'}
          style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center' }}
        >
          {state === 'loading' ? (
            <>
              <Spin size="small" />
              <span>{message}</span>
            </>
          ) : (
            <EmptyState description={message} />
          )}
        </div>
      )}
    </div>
  );
}
