import { history } from '@umijs/max';

export function openReport(href: string | undefined): void {
  if (href) history.push(href);
}
