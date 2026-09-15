# Phase 7 verification checklist

- [ ] Migration adds nullable prospect, partner and contact foreign keys.
- [ ] Historical invitation rows remain valid.
- [ ] Organization 360 launch passes only a prospect ID in the URL.
- [ ] Business/contact details are resolved server-side rather than trusted from URL parameters.
- [ ] Primary contact is preferred; fallback contact is used only when no primary exists.
- [ ] Missing contact data remains blank.
- [ ] Invitation creation does not send anything.
- [ ] AI draft cannot approve or send.
- [ ] Approval remains a distinct human action.
- [ ] Sending remains a distinct human action.
- [ ] WhatsApp-only sending remains blocked until a real provider is configured.
- [ ] CRM activity is written when contextual invitation creation is completed.
- [ ] CI and Quality pass before merge.
- [ ] Supabase migration is applied and indexes verified after merge.
- [ ] Hostinger production deployment is verified separately from GitHub merge.
