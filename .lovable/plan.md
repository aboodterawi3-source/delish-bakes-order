# Delish reference-layout rebuild

## Goal
Replace the storefront’s visible design with a close, responsive recreation of the supplied split-card reference while retaining ordering, checkout, staff, and kitchen workflows.

## Storefront
- Rebuild `/` as one centered split card: powder-blue brand panel and white content panel, matching the reference proportions, radii, spacing, shadows, typography hierarchy, icon tiles, divider, primary button, and operating-hours footer.
- Stack the brand panel above the content panel on mobile while preserving the same styling.
- Use the exact English reference copy shown in the image.
- Style only both “Delish” wordmarks with metallic-gold fill and a crisp 1px black stroke.
- Make **Order** and **Visit Our Shop** open the full custom-cake experience.
- Keep a direct **Browse** path into the existing product catalogue and preserve the cart/WhatsApp checkout flow without displaying the old long-form homepage by default.

## Ordering experience
- Present the existing cake builder as a modal launched from the new storefront.
- Preserve size, flavor/filling, frosting/color choices, inscription, cart, delivery/pickup details, and formatted WhatsApp checkout.
- Add a design-reference image upload with preview and include it in saved order details.

## Staff tools
- Preserve `/admin` and extend it with sales analytics, searchable customer phone directory, Excel-compatible export, and thermal-print order receipts.
- Add `/kds` with color-coded live order lanes, preparation details, audible new-order alerts, and editable fulfillment date/time.
- Keep order updates synchronized between storefront, admin, and KDS in the browser and preserve WhatsApp status links.

## Technical details
- Reuse semantic design tokens; derive the reference palette in `src/styles.css` without adding arbitrary component-level colors.
- Keep Arabic RTL and English LTR behavior in ordering surfaces; the reference landing composition remains faithful to the supplied English mockup.
- Add route-specific metadata for `/kds`, preserve existing metadata for `/admin`, and keep keyboard/dialog accessibility.
- Validate desktop and mobile layouts plus the Order, Visit Our Shop, upload, checkout, admin export/print, and KDS update flows in the running preview.
