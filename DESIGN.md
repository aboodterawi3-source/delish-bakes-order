# Delish Cake & Bake — Brand & Design System (DESIGN.md)

> **Design Standard for Delish Boutique Patisserie**  
> Established via `awesome-design-md` and `design-taste-frontend`.  
> _Language:_ Native Arabic (RTL default) with English localization.  
> _Aesthetic:_ Warm Artisan Boutique Bakery, tactile, trustworthy, and appetising.

---

## 1. Visual Identity & Brand Philosophy

Delish is an artisan patisserie founded in Amman, Jordan. Its visual identity must convey **warmth, artisanal freshness, natural ingredients, and celebratory joy** without falling into corporate coldness or chaotic ornamentation.

### Core Visual Principles

1. **Sensory Warmth:** Backgrounds evoke vanilla cream, parchment, and warm oven light (`#FAF6F0` to `#FFFDF9`). Avoid clinical pure white backgrounds (`#FFFFFF`) for large surfaces.
2. **Calculated Elegance (No Gaudy Gold):** Accents use warm caramel, honey, and subtle satin gold (`#D4AF37` / `#C59B27`) paired with deep espresso brown (`#2C1A11` / `#3D271D`) for typography.
3. **Product-First Heroics:** High-resolution, un-obscured cake and pastry imagery. The bakery craft is the hero—menus, labels, and badges support the product rather than compete with it.
4. **Mobile-First Touch Ergonomics:** 70%+ of Amman orders originate on mobile devices (iOS/Android) via WhatsApp and mobile web. Touch targets must be $\ge 44 \times 44\text{ px}$, with floating thumb-friendly cart drawers.

---

## 2. Color System & Semantic Tokens

```
+-------------------------------------------------------------------------------+
|  Token Name          |  Hex Value   |  Purpose                               |
+----------------------+--------------+----------------------------------------+
|  --bg-primary        |  #FAF6F0     |  Page canvas, warm bakery cream        |
|  --bg-card           |  #FFFFFF     |  Product cards, modals, sheets         |
|  --text-primary      |  #2C1A11     |  Deep roasted espresso for headings    |
|  --text-secondary    |  #6B5548     |  Warm muted brown for descriptions     |
|  --accent-gold       |  #C59B27     |  Boutique badges, subtle highlights    |
|  --accent-caramel    |  #E28743     |  Warm action accents & hover borders   |
|  --brand-primary     |  #8B4513     |  Primary CTA buttons & header brand    |
|  --status-pending    |  #F59E0B     |  Amber: New order awaiting kitchen     |
|  --status-baking     |  #3B82F6     |  Blue: In oven / preparation           |
|  --status-ready      |  #10B981     |  Emerald: Ready for pickup / delivery  |
|  --status-cancelled  |  #EF4444     |  Red: Cancelled / refunded             |
+-------------------------------------------------------------------------------+
```

---

## 3. Typography Hierarchy

### Arabic Typography (Primary RTL)

- **Display & Headings:** `Cairo`, `Amiri`, or `Tajawal` with optical sizing.
  - `H1 (Hero Title):` 32px - 44px, `font-bold`, leading tight, deep espresso.
  - `H2 (Section Titles):` 22px - 28px, `font-semibold`.
  - `H3 (Product Titles):` 16px - 19px, `font-bold`.
- **Body & Numerical Values:**
  - Standard body: 14px - 15px, `font-normal`, high contrast (`--text-secondary`).
  - Currency & Price Numbers: Clean tabular digits (`font-mono` or `font-semibold`) always followed by official currency formatter `formatJod` / `د.أ`.

---

## 4. Component Rules

### Product Cards (`ProductCard`)

- **Aspect Ratio:** $4:3$ or $1:1$ squircle (`rounded-2xl` to `rounded-3xl`) with smooth overflow clip.
- **Card Shadow:** Soft, warm shadow: `box-shadow: 0 4px 20px -2px rgba(44, 26, 17, 0.06)`.
- **Badge Placement:** Top corner (RTL: top-right) with slight backdrop blur (`backdrop-blur-sm`).
- **Action Bar:** Prominent "Add to Cart" / "Customize" button with immediate touch feedback.

### Sticky Cart Drawer & Checkout Bar

- Mobile viewport retains a sticky bottom action bar displaying:
  - Item counter chip.
  - Running subtotal formatted in JOD (`jd(...)`).
  - High-visibility "إتمام الطلب" CTA button.

### Kitchen Display System (KDS) Cards

- Large, high-contrast typography readable from 2 meters on wall-mounted tablets.
- **Privacy Shield:** Strictly strip customer phone numbers and financial prices from kitchen cards. Only display line items, custom writing on cake (`inscription`), and baking notes.

---

## 5. Micro-interactions & Delight

1. **Cart Increment/Decrement:** Springy bounce animation (`scale(1.08)`) on quantity change.
2. **Order Submission:** Confetti / celebratory checkmark on order confirmation screen.
3. **WhatsApp Link Out:** Smooth handoff with pre-formatted Jordan phone number and clean receipt text.
