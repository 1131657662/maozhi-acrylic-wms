import { z } from 'zod';
import { ApiError } from '../../api/errors';
import { RequestError } from '../../components/RequestError';
import { text } from './copy';

const product = z.object({ code: z.string(), name: z.string() });
const hintsSchema = z.object({ products: z.array(product).optional(), mappedProduct: product.optional() });
export function CountingError({ error }: { error: unknown }) {
  const hints = hintsSchema.safeParse(error instanceof ApiError ? error.data : undefined);
  const products = hints.success
    ? (hints.data.products ?? (hints.data.mappedProduct ? [hints.data.mappedProduct] : []))
    : [];
  return (
    <RequestError
      error={error}
      description={
        products.length ? (
          <div>
            {text.product}：{products.map((p) => `${p.name}（${p.code}）`).join('、')}
          </div>
        ) : undefined
      }
    />
  );
}
