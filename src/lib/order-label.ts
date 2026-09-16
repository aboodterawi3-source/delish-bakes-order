/** Display label for an order number, prefixed by the employee's numeric ID
 *  when one is assigned by the manager (e.g. "1 / DL-1"). */
export const orderLabel = (orderNumber: string, staffCode?: number | null): string =>
  staffCode ? `${staffCode} / ${orderNumber}` : orderNumber;
