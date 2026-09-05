import { computeNestedCommissionSplit } from "./commission-split";

type CommissionPreviewInput = {
  saleValue: number;
  totalCommissionRate: number;
  specialistShareRate: number;
  officeShareRate: number;
};

type CommissionPreview = {
  totalCommissionValue: number;
  platformValue: number;
  officeValue: number;
  specialistValue: number;
};

export function getCommissionPreview({
  saleValue,
  totalCommissionRate,
  specialistShareRate,
  officeShareRate,
}: CommissionPreviewInput): CommissionPreview {
  const safeSaleValue = Number.isFinite(saleValue) ? saleValue : 0;
  const safeTotalCommissionRate = Number.isFinite(totalCommissionRate)
    ? totalCommissionRate
    : 0;
  const safeSpecialistShareRate = Number.isFinite(specialistShareRate)
    ? specialistShareRate
    : 0;
  const safeOfficeShareRate = Number.isFinite(officeShareRate)
    ? officeShareRate
    : 0;
  const split = computeNestedCommissionSplit({
    proposalValue: safeSaleValue,
    totalCommissionRate: safeTotalCommissionRate,
    specialistShareRate: safeSpecialistShareRate,
    officeShareRate: safeOfficeShareRate,
  });

  return {
    totalCommissionValue: split.bolo,
    platformValue: split.platformValue,
    officeValue: split.officeValue,
    specialistValue: split.specialistValue,
  };
}
