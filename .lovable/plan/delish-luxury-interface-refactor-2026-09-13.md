# Delish luxury interface refactor

## Goal
Replace the current showcase and mixed legacy styling with the supplied three-screen Delish experience, while preserving ordering, cart, authentication, realtime, and staff workflows.

## Public storefront
- Make `/` render the clean welcome experience directly, with no demo header, device frames, or staff shortcuts.
- Rebuild `/welcome` with exactly four isolated corner macarons, sweeping gold curves, centered gold/bronze branding, the supplied headline, and peach CTA.
- Refine `/discover` to match the catalog reference: avatar/logo/actions header, peach croissant offer, horizontal categories, and polished product cards with size and quantity controls.
- Refine `/product-details` to match the reference gallery, content hierarchy, selectors, price, and brown pill CTA.
- Keep existing cart and checkout behavior connected across catalog and product details.

## Internal portals
- Apply one cream, gold, bronze, peach, and dark-brown token system to staff login/setup, Sales, Kitchen/KDS, Admin, and Social pages.
- Replace dark/default shells with cream backgrounds, white rounded surfaces, gold accents, readable high-contrast status colors, and consistent typography.
- Add `/login` as the staff sign-in URL and `/kitchen` as the kitchen URL while keeping existing `/auth` and `/kds` links working for compatibility.

## Cleanup and quality
- Remove obsolete showcase-only code and imports so legacy UI is no longer reachable.
- Use semantic design tokens in the global stylesheet instead of scattered raw colors for the refactored surfaces.
- Add complete, unique metadata to all public/content routes touched by the change.
- Verify desktop and mobile storefront screens, staff sign-in, route aliases, interactions, console errors, and layout overflow with browser checks.

## Technical details
- Preserve TanStack file routing and authenticated route protection.
- Preserve existing backend calls, permissions, realtime listeners, menu management, checkout, and WhatsApp behavior.
- Keep the supplied screenshot as a visual reference only; use the project’s existing bakery assets.
