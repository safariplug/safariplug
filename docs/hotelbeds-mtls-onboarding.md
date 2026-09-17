# Hotelbeds mTLS onboarding for SafariPlug

Hotelbeds Hotel Booking API operations including Availability, CheckRate and booking management require mutual TLS (mTLS).

## 1. Create the client certificate in Hotelbeds

In the Hotelbeds / HBX Group developer portal, open **Dashboard → My API Certificates**.

1. Use **Create Secret** and retrieve the one-time certificate secret from the developer-account email.
2. Generate a private key and CSR locally with OpenSSL.
3. Use **Create Certificate**, paste/upload the CSR, and download the issued client certificate.
4. Associate that certificate with the same Hotelbeds API key used by SafariPlug.

Keep the private key private. Do not send it to Hotelbeds or commit it to Git.

## 2. Configure SafariPlug server secrets

Set the following production environment variables as multiline PEM values:

- `SAFARIPLUG_HOTEL_HOTELBEDS_CERT_PEM` — issued client certificate, including `BEGIN CERTIFICATE` / `END CERTIFICATE` lines.
- `SAFARIPLUG_HOTEL_HOTELBEDS_PRIVATE_KEY_PEM` — matching private key, including its PEM boundary lines.
- `SAFARIPLUG_HOTEL_HOTELBEDS_CA_PEM` — optional CA bundle when required by the runtime/certificate chain.

SafariPlug also accepts the aliases without `_PEM`, but the `_PEM` names are preferred.

Existing Hotel API authentication still uses:

- `SAFARIPLUG_HOTEL_HOTELBEDS_API_KEY`
- `SAFARIPLUG_HOTEL_HOTELBEDS_SECRET`

Do not expose any of these values to the browser or commit them to the repository.

## 3. Verify

After the environment variables are installed and the application is redeployed:

1. Open `/admin/integrations/hotelbeds`.
2. Confirm **Hotel mTLS → Configured**.
3. Click **Verify API health**.
4. Click **Run 1 availability probe** exactly once.

The availability probe makes one Hotelbeds Availability request against up to 20 locally cached hotel codes. It does not create a payment, CheckRate call, booking or cancellation.

## Endpoints

- Test mTLS: `api-mtls.test.hotelbeds.com`
- Production mTLS: `api-mtls.hotelbeds.com`
