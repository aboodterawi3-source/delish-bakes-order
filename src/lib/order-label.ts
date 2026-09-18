/** Display label for an order number, showing staff ID badge when present or online tag as fallback. */
export const orderLabel = (orderNumber: string, staffCode?: number | null): string => {
  if (staffCode && Number(staffCode) > 0) {
    return `${orderNumber} [موظف #${staffCode}]`;
  }
  return `${orderNumber} [أونلاين]`;
};

