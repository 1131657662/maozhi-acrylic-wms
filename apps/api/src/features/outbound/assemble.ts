import type { z } from 'zod';
import { detailSchema, type Detail } from '@wms/contracts';
import { factDigest } from './fact-projection.ts';
import type { headerSchema, rawLineSchema, rawFactSchema } from './rows.ts';

type Header = z.infer<typeof headerSchema>;
type Line = z.infer<typeof rawLineSchema>;
type Fact = z.infer<typeof rawFactSchema>;
export function assembleOrders(headers: Header[], data: {lines: Line[];facts: Fact[];products: Map<string,string>}): Detail[] {
  return headers.map((header) => assembleOrder(header,data));
}
function assembleOrder(header: Header, data: {lines: Line[];facts: Fact[];products: Map<string,string>}): Detail {
  const facts = data.facts.filter((fact) => fact.planId === header.id);
  const lines = data.lines.filter((line) => line.orderId === header.id).map((line) => {
    const matching = facts.filter((fact) => data.products.get(fact.id) === line.id);
    return {...line,actualPackages:matching.length,actualWeightGrams:matching.reduce((sum,fact)=>sum+fact.weightGrams,0)};
  });
  return detailSchema.parse({...header,lines,facts,
    plannedPackages:lines.reduce((sum,line)=>sum+line.plannedPackages,0),
    plannedWeightGrams:lines.reduce((sum,line)=>sum+line.plannedWeightGrams,0),
    actualPackages:facts.length,actualWeightGrams:facts.reduce((sum,fact)=>sum+fact.weightGrams,0),
    digest:factDigest(facts),
  });
}
