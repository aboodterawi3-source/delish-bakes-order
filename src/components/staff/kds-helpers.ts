import type { KdsOrder, KitchenStage } from "@/lib/kds.functions";
import type { PriorityColor } from "@/lib/priority";

const PACKAGING_KEYWORDS = [
  "شمعة",
  "شموع",
  "بالون",
  "بالونات",
  "توبر",
  "كرت",
  "topper",
  "candle",
  "balloon",
];

export const stageOf = (status: string): KitchenStage =>
  status === "ready" ? "ready" : status === "baking" ? "baking" : "new";

/** Splits KDS items into primary bakery items vs. packaging accessories. */
export function splitKitchenItems(items: KdsOrder["items"]) {
  const mainItems: KdsOrder["items"] = [];
  const accessoryItems: KdsOrder["items"] = [];
  for (const item of items) {
    const name = (item.name_ar || "").toLowerCase();
    if (PACKAGING_KEYWORDS.some((kw) => name.includes(kw))) {
      accessoryItems.push(item);
    } else {
      mainItems.push(item);
    }
  }
  return { mainItems, accessoryItems };
}

/** Strips marketing, communication channel tags, and payment meta from kitchen views. */
export function isChannelOrMeta(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    t.startsWith("المصدر:") ||
    t.startsWith("مصدر:") ||
    t.includes("المصدر: ") ||
    t.includes("واتساب") ||
    t.includes("انستغرام") ||
    t.includes("فيسبوك") ||
    t.includes("تيك توك") ||
    t.includes("كليك") ||
    t.includes("حوالة") ||
    t.includes("gift") ||
    t.includes("source") ||
    t.startsWith("طلب هدية")
  );
}

/** Formats time remaining with SLA color indicators: Safe (>45m), Urgent (<20m), Overdue (Late). */
export function getCountdownText(requestedDate: string, requestedTime: string) {
  if (!requestedDate || !requestedTime) {
    return { text: "الموعد غير محدد", status: "normal" as const };
  }

  try {
    const timeClean = requestedTime.slice(0, 5);
    const target = new Date(`${requestedDate}T${timeClean}:00`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const lateMins = Math.abs(diffMins);
      const lateStr =
        lateMins >= 60 ? `${Math.floor(lateMins / 60)}س ${lateMins % 60}د` : `${lateMins}د`;
      return { text: `متأخر: -${lateStr}`, status: "overdue" as const, mins: diffMins };
    }

    if (diffMins <= 20) {
      return { text: `مستعجل: ${diffMins} دقيقة`, status: "urgent" as const, mins: diffMins };
    }

    if (diffMins <= 45) {
      return { text: `باقي: ${diffMins} دقيقة`, status: "normal" as const, mins: diffMins };
    }

    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return {
      text: `باقي: ${hours > 0 ? `${hours}س ` : ""}${remMins}د`,
      status: "safe" as const,
      mins: diffMins,
    };
  } catch {
    return { text: requestedTime.slice(0, 5), status: "normal" as const, mins: 999 };
  }
}

/** Resolves visual priority styles for KDS cards. */
export function getPriorityStyles(color: PriorityColor) {
  switch (color) {
    case "dark_red":
      return {
        cardBg: "bg-card border-orange-400/80 shadow-xs",
        badgeBg: "bg-orange-100 text-orange-950 border-orange-300",
        badgeText: "أولوية قصوى",
      };
    case "warm_orange":
      return {
        cardBg: "bg-card border-amber-400/80 shadow-xs",
        badgeBg: "bg-amber-100 text-amber-950 border-amber-300",
        badgeText: "توصيل سريع",
      };
    case "sky_blue":
      return {
        cardBg: "bg-card border-emerald-400/80 shadow-xs",
        badgeBg: "bg-emerald-100 text-emerald-950 border-emerald-300",
        badgeText: "تجهيز عادي",
      };
    case "golden_yellow":
      return {
        cardBg: "bg-card border-yellow-400 shadow-xs",
        badgeBg: "bg-yellow-100 text-yellow-950 border-yellow-400",
        badgeText: "VIP خاص",
      };
    case "soft_green":
    default:
      return {
        cardBg: "bg-card border-border/80 shadow-xs",
        badgeBg: "bg-secondary text-foreground border-border",
        badgeText: "طلب عادي",
      };
  }
}

/** Downloads a reference design image for edible printing. */
export async function downloadDesignImage(url: string, orderNumber: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const rawExtension = blob.type.split("/")[1] ?? "jpg";
    const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, "").replace("jpeg", "jpg") || "jpg";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `delish-${orderNumber}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
