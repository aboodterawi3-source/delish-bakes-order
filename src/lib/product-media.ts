import cakeChocImg from "@/assets/cake-choc.jpg";
import cakeBerryImg from "@/assets/cake-berry.jpg";
import cakeRedImg from "@/assets/cake-red.jpg";
import cheesecakeImg from "@/assets/cheesecake.jpg";
import browniesImg from "@/assets/brownies.jpg";
import cupcakesImg from "@/assets/cupcakes.jpg";
import luxuryCakeImg from "@/assets/luxury-cake-showcase.jpg";

export type ProductPhotoSource = {
  image_url?: string | null | undefined;
  name_ar?: string | null | undefined;
  name_en?: string | null | undefined;
  category?: string | null | undefined;
  slug?: string | null | undefined;
};

/**
 * Returns either the published cloud image URL or a matching high-resolution signature project asset.
 * Ensures that all 6 Delish products always display authentic, mouth-watering pastry photography.
 */
export function resolveProductPhoto(product?: ProductPhotoSource | null): string {
  if (!product) return luxuryCakeImg;
  if (product.image_url && product.image_url.trim().length > 0) {
    return product.image_url.trim();
  }
  const text = `${product.name_ar || ""} ${product.name_en || ""} ${product.category || ""} ${product.slug || ""}`.toLowerCase();

  if (text.includes("شوكولاتة") || text.includes("نوتيلا") || text.includes("choc") || text.includes("chocolate")) {
    return cakeChocImg;
  }
  if (text.includes("ريد فيلفيت") || text.includes("فيلفيت") || text.includes("red velvet") || text.includes("red")) {
    return cakeRedImg;
  }
  if (
    text.includes("فستق") ||
    text.includes("pistachio") ||
    text.includes("ورد") ||
    text.includes("توت") ||
    text.includes("berry")
  ) {
    return cakeBerryImg;
  }
  if (text.includes("تشيز كيك") || text.includes("تشيزكيك") || text.includes("cheese") || text.includes("cheesecake")) {
    return cheesecakeImg;
  }
  if (
    text.includes("براونيز") ||
    text.includes("كوكيز") ||
    text.includes("بسكويت") ||
    text.includes("brownies") ||
    text.includes("cookies")
  ) {
    return browniesImg;
  }
  if (
    text.includes("فردية") ||
    text.includes("كب كيك") ||
    text.includes("cupcake") ||
    text.includes("cupcakes") ||
    text.includes("توابع")
  ) {
    return cupcakesImg;
  }

  // Default signature multi-tiered celebration cake showcase
  return luxuryCakeImg;
}
