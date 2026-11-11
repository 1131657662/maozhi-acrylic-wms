import { useEffect } from 'react';
import type { FormInstance } from 'antd';
import { friendlyError } from '../api/errors';

export function useFormErrors(error: unknown, form: FormInstance) {
  useEffect(() => {
    if (!error) return;
    const info = friendlyError(error);
    if (info.kind !== 'VALIDATION') return;
    const fields = info.fields.map(({ path, message }) => ({
      name: path.map((part) =>
        part === 'actualWeightGrams'
          ? 'actualWeightTonnes'
          : part === 'weightGrams'
            ? 'weightTonnes'
            : part === 'plannedWeightGrams'
              ? 'plannedWeightTonnes'
              : part,
      ),
      errors: [message],
    }));
    form.setFields(fields);
    if (fields[0]) form.scrollToField(fields[0].name, { focus: true, behavior: 'instant', block: 'center' });
  }, [error, form]);
}
