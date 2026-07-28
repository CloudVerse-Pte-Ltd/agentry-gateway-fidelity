const SECRET_KEY = /authorization|api[-_]?key|cookie|secret|token/i;
const SECRET_VALUE = /(?:sk|key|token)[-_][A-Za-z0-9._-]{8,}/gi;

export function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(SECRET_VALUE, "[REDACTED]");
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : redact(item)]));
  }
  return value;
}

export function safeUrl(raw: string): string {
  const url = new URL(raw);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
