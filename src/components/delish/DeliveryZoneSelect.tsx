import { useMemo } from "react";
import {
  DELIVERY_ZONES,
  OTHER_GOVERNORATES_AREA,
  feeForArea,
} from "@/lib/delivery-zones";
import { formatJod } from "@/lib/currency";

export interface DeliveryZoneSelectProps {
  value: string;
  onChange: (area: string, fee: number | null) => void;
  className?: string;
  noteClassName?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  showFeeNote?: boolean;
  lang?: "ar" | "en";
  placeholder?: string;
}

export function DeliveryZoneSelect({
  value,
  onChange,
  className = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground",
  noteClassName,
  id,
  name,
  disabled = false,
  required = false,
  showFeeNote = true,
  lang = "ar",
  placeholder,
}: DeliveryZoneSelectProps) {
  const areaFee = useMemo(() => feeForArea(value), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedArea = e.target.value;
    const fee = feeForArea(selectedArea);
    onChange(selectedArea, fee);
  };

  const defaultPlaceholder =
    placeholder || (lang === "ar" ? "اختر المنطقة" : "Select your area");

  const isOther = value.trim() === OTHER_GOVERNORATES_AREA;

  return (
    <div className="w-full space-y-1">
      <select
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className={className}
      >
        <option value="">{defaultPlaceholder}</option>
        {DELIVERY_ZONES.map((zone) => (
          <optgroup
            key={zone.labelEn}
            label={lang === "ar" ? zone.labelAr : zone.labelEn}
          >
            {zone.areas.map((area) => (
              <option key={`${zone.labelEn}-${area}`} value={area}>
                {area === OTHER_GOVERNORATES_AREA
                  ? lang === "ar"
                    ? `${area} (٥–٨ د.أ)`
                    : `${area} (5–8 JOD)`
                  : `${area} — ${formatJod(zone.fee, lang)}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {showFeeNote && value && (
        <span
          className={
            noteClassName ||
            "-mt-1 block text-xs font-semibold text-muted-foreground"
          }
        >
          {isOther
            ? lang === "ar"
              ? "أجرة التوصيل للمحافظات الأخرى من ٥ إلى ٨ د.أ — يحددها فريقنا عند تأكيد الطلب حسب العنوان."
              : "Delivery to other governorates is 5–8 JOD — our team confirms the exact fee based on your address."
            : areaFee !== null
              ? lang === "ar"
                ? `أجرة التوصيل لهذه المنطقة: ${formatJod(areaFee, "ar")}`
                : `Delivery fee for this area: ${formatJod(areaFee, "en")}`
              : null}
        </span>
      )}
    </div>
  );
}
