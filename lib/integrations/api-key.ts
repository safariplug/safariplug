export function validateIntegrationKey(
  request: Request
): boolean {
  const providedKey = request.headers.get("x-api-key");
  const expectedKey = process.env.AURELIAN_API_KEY;

  if (!providedKey || !expectedKey) {
    return false;
  }

  if (providedKey.length !== expectedKey.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }

  return result === 0;
}
