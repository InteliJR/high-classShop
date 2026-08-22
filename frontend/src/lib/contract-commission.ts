type CommissionPreviewInput = {
  saleValue: number;
  totalCommissionRate: number;
  specialistShareRate: number;
};

type CommissionPreview = {
  totalCommissionValue: number;
  specialistValue: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function getCommissionPreview({
  saleValue,
  totalCommissionRate,
  specialistShareRate,
}: CommissionPreviewInput): CommissionPreview {
  const safeSaleValue = Number.isFinite(saleValue) ? saleValue : 0;
  const safeTotalCommissionRate = Number.isFinite(totalCommissionRate)
    ? totalCommissionRate
    : 0;
  const safeSpecialistShareRate = Number.isFinite(specialistShareRate)
    ? specialistShareRate
    : 0;
  const totalCommissionValue = round2(
    (safeSaleValue * safeTotalCommissionRate) / 100,
  );
  const specialistValue = round2(
    (totalCommissionValue * safeSpecialistShareRate) / 100,
  );

  return { totalCommissionValue, specialistValue };
}
