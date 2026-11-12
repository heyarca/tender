/** Only PayPal-hosted invoice pages may become links in the transcript. */
export function validatedInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hosts = ["www.paypal.com", "paypal.com", "www.sandbox.paypal.com", "sandbox.paypal.com"];
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) return null;
    if (!/^\/(?:invoice\/(?:p\/|payerView\/)|invoices\/pay\/)/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Read a payer link supplied by PayPal, never construct one from an invoice id. */
export function invoiceUrlFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const result = value as {
    href?: unknown; rel?: unknown;
    links?: { href?: unknown; rel?: unknown }[];
    detail?: { metadata?: { recipient_view_url?: unknown } };
  };
  const recipient = validatedInvoiceUrl(result.detail?.metadata?.recipient_view_url);
  if (recipient) return recipient;
  const links = [result, ...(Array.isArray(result.links) ? result.links : [])];
  for (const link of links) {
    if (link?.rel !== "payer-view") continue;
    const href = validatedInvoiceUrl(link.href);
    if (href) return href;
  }
  return null;
}
