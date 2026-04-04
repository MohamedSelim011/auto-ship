/**
 * QPExpress delivery statuses:
 * Pending | Out For Deliver | Delivered | Hold | Undelivered | Rejected
 *
 * Shopify fulfillment event statuses:
 * LABEL_PRINTED | LABEL_PURCHASED | ATTEMPTED_DELIVERY | READY_FOR_PICKUP
 * CONFIRMED | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | FAILURE
 */

export const QP_STATUS = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out For Deliver",
  DELIVERED: "Delivered",
  HOLD: "Hold",
  UNDELIVERED: "Undelivered",
  REJECTED: "Rejected",
} as const;

export type QPStatus = (typeof QP_STATUS)[keyof typeof QP_STATUS];

/** Maps QPExpress status → Shopify fulfillment event status (null = no event needed) */
export const QP_TO_SHOPIFY_EVENT: Record<string, string | null> = {
  [QP_STATUS.PENDING]: null,
  [QP_STATUS.OUT_FOR_DELIVERY]: "OUT_FOR_DELIVERY",
  [QP_STATUS.DELIVERED]: "DELIVERED",
  [QP_STATUS.HOLD]: "FAILURE",
  [QP_STATUS.UNDELIVERED]: "ATTEMPTED_DELIVERY",
  [QP_STATUS.REJECTED]: "FAILURE",
};

/** Returns true if a Shopify fulfillment should be created for this status */
export function shouldCreateFulfillment(qpStatus: string): boolean {
  return qpStatus !== QP_STATUS.PENDING;
}

/** Human-readable label for display in the UI */
export const QP_STATUS_LABEL: Record<string, string> = {
  [QP_STATUS.PENDING]: "Pending",
  [QP_STATUS.OUT_FOR_DELIVERY]: "Out For Delivery",
  [QP_STATUS.DELIVERED]: "Delivered",
  [QP_STATUS.HOLD]: "On Hold",
  [QP_STATUS.UNDELIVERED]: "Undelivered",
  [QP_STATUS.REJECTED]: "Rejected",
};

/** Badge tone for Polaris display */
export const QP_STATUS_TONE: Record<string, string> = {
  [QP_STATUS.PENDING]: "warning",
  [QP_STATUS.OUT_FOR_DELIVERY]: "neutral",
  [QP_STATUS.DELIVERED]: "success",
  [QP_STATUS.HOLD]: "caution",
  [QP_STATUS.UNDELIVERED]: "critical",
  [QP_STATUS.REJECTED]: "critical",
};
