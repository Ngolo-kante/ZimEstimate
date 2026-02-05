export type PricingFields = {
  averagePriceUsd: number;
  averagePriceZwg: number;
  actualPriceUsd: number;
};

export function getScaledPriceZwg(
  actualUsd: number,
  averageUsd: number,
  averageZwg: number,
  exchangeRate: number
): number {
  if (averageUsd && averageZwg) {
    return (actualUsd / averageUsd) * averageZwg;
  }
  return actualUsd * exchangeRate;
}

export function calculateVariance(averageUsd: number, actualUsd: number) {
  const variance = actualUsd - averageUsd;
  const variancePct = averageUsd ? (variance / averageUsd) * 100 : null;
  return { variance, variancePct };
}

export function applyAveragePriceUpdate(
  item: PricingFields,
  nextAverageUsd: number,
  nextAverageZwg: number,
  exchangeRate: number
) {
  const actualWasAverage = item.actualPriceUsd === item.averagePriceUsd;
  const nextActualUsd = actualWasAverage ? nextAverageUsd : item.actualPriceUsd;
  const nextActualZwg = getScaledPriceZwg(nextActualUsd, nextAverageUsd, nextAverageZwg, exchangeRate);

  return {
    averagePriceUsd: nextAverageUsd,
    averagePriceZwg: nextAverageZwg,
    actualPriceUsd: nextActualUsd,
    actualPriceZwg: nextActualZwg,
  };
}
