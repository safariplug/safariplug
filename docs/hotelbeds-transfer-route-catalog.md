# Hotelbeds Transfers route catalogue verification

SafariPlug must not guess Hotelbeds ATLAS identifiers.

The admin Transfers verification flow now uses the Hotelbeds Transfers CACHE API route portfolio first. Staff enter a Hotelbeds destination code, explicitly request a small page of routes, select a returned `from.type/from.code -> to.type/to.code` pair, and only then run the existing controlled Availability request.

Safety constraints:

- no supplier call occurs on page load
- route lookup is admin-only and explicit
- route lookup makes one supplier CACHE API request
- Availability remains a separate explicit supplier request
- verification cannot create, retrieve, or cancel a booking
- supplier credentials and secrets are never returned to the browser
- manual route fields remain visible for diagnostics, but catalogue selection is the preferred path
