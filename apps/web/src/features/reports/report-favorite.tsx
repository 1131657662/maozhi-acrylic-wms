import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, theme, Tooltip } from 'antd';
import { useState } from 'react';
import { businessCopy } from '../../business-copy';

const STORAGE_KEY = 'b7a-report-favorites:v1';

function readFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
  } catch {
    return [];
  }
}

export function ReportFavoriteButton({ report }: { report: string }) {
  const [favorites, setFavorites] = useState(readFavorites),
    { token } = theme.useToken(),
    favorite = favorites.includes(report),
    label = favorite ? businessCopy.reportsUnfavorite : businessCopy.reportsFavorite;

  function toggleFavorite() {
    const next = favorite ? favorites.filter((item) => item !== report) : [...favorites, report];
    setFavorites(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Keep the current page state when browser storage is unavailable.
    }
  }

  return (
    <Tooltip title={label}>
      <Button
        type="text"
        aria-label={label}
        icon={
          favorite ? (
            <StarFilled style={{ color: token.colorWarning }} />
          ) : (
            <StarOutlined style={{ color: token.colorTextSecondary }} />
          )
        }
        onClick={toggleFavorite}
      />
    </Tooltip>
  );
}
