/** Amounts of automatic top-ups. No server imports, so the panel and the account page read them too. */

/** One automatic top-up by Ask Tender: $5.00, or less when the weekly limit leaves less. */
export const AUTO_TOP_UP_MICROS = 5_000_000;
/** Before an agent charge, Ask Tender tops up when the balance is below $1.00 or below the charge. */
export const LOW_BALANCE_MICROS = 1_000_000;
