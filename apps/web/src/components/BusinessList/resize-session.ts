interface ResizeSession {
  rows: HTMLElement[];
  display: string[];
  rollback: (() => void)[];
  active: boolean;
}

const sessions = new WeakMap<Element, ResizeSession>();

function release(root: Element, session: ResizeSession): void {
  session.rows.forEach((row, index) => {
    row.style.display = session.display[index]!;
  });
  sessions.delete(root);
}

export function beginResizeSession(root: Element) {
  let session = sessions.get(root);
  if (!session) {
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.ant-table-measure-row'));
    session = { rows, display: rows.map((row) => row.style.display), rollback: [], active: false };
    rows.forEach((row) => {
      row.style.display = 'none';
    });
    sessions.set(root, session);
  }
  const current = session;
  current.active = true;
  return {
    commit(rollback: () => void) {
      current.rollback.push(rollback);
      current.active = false;
    },
    cancel() {
      current.active = false;
      if (!current.rollback.length) release(root, current);
    },
  };
}

// Restore the previous React-owned styles before explicit reset/view/column-setting updates.
export function rollbackResizeSession(root: Element): void {
  const session = sessions.get(root);
  if (!session || session.active) return;
  session.rollback.toReversed().forEach((rollback) => rollback());
  release(root, session);
}

// A normal table render has now consumed the live widths; measuring can resume.
export function completeResizeRender(root: Element): void {
  const session = sessions.get(root);
  if (session && !session.active) release(root, session);
}
