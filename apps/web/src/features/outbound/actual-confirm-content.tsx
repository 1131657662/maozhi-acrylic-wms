import { actualText as text } from './actual-text';
import { type ActualQuantity, type Detail } from '@wms/contracts';

export function ActualConfirmContent({ order, lines }: { order: Detail; lines: ActualQuantity[] }) {
  const packages = lines.reduce((sum, line) => sum + line.actualPackages, 0);
  const grams = lines.reduce((sum, line) => sum + line.actualWeightGrams, 0);
  const differences = lines.filter((line) => {
    const plan = order.lines.find((item) => item.id === line.lineId)!;
    return line.actualPackages !== plan.plannedPackages || line.actualWeightGrams !== plan.plannedWeightGrams;
  });
  return (
    <div>
      <p>{text.deduction(packages, grams)}</p>
      {differences.map((line) => {
        const plan = order.lines.find((item) => item.id === line.lineId)!;
        return (
          <p key={line.lineId}>
            {text.planDifference(
              plan.productName,
              plan.plannedPackages,
              plan.plannedWeightGrams,
              line.actualPackages,
              line.actualWeightGrams,
            )}
          </p>
        );
      })}
    </div>
  );
}
