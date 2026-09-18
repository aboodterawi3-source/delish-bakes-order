import { DelishLogo } from '@/components/delish/DelishLogo';
import type { SalesOrder } from '@/lib/sales.functions';
import { orderLabel } from '@/lib/order-label';

interface EditOrderHeaderProps {
  order?: SalesOrder | null;
}

export function EditOrderHeader({ order }: EditOrderHeaderProps) {
  return (
    <div className="flex flex-col items-center mb-6">
      <DelishLogo size="lg" showSubtitle />
      {order && (
        <h1 className="mt-4 text-xl font-bold text-[#3E2723]">
          طلب <span dir="ltr">{orderLabel(order.order_number, order.staff_code)}</span>
        </h1>
      )}
    </div>
  );
}
