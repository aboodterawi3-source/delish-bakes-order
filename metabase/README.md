# Metabase BI & Analytics Integration — Delish & Bake

هذا المجلد يحتوي على إعدادات واستعلامات منصة ذكاء الأعمال مفتوحة المصدر **[Metabase](https://github.com/metabase/metabase)** لمراقبة وتحليل بيانات متجر وكاشير وحسابات **Delish Cake & Bake**.

## محتويات المجلد

- `docker-compose.metabase.yml`: ملف تشغيل حاوية Metabase المحلية وربطها بقاعدة بيانات PostgreSQL.
- `queries/`:
  - `01_daily_revenue_and_channel.sql`: تحليل الإيرادات اليومية وتوزيعها على قنوات الاستلام والتوصيل.
  - `02_top_bakery_products.sql`: أكثر الكيكات والحلويات مبيعاً وإيراداً.
  - `03_kitchen_kds_turnaround.sql`: مراقبة خط إنتاج المطبخ (KDS) وزمن المعالجة والطلبات المستعجلة.
  - `04_financial_refund_audit.sql`: تدقيق المبالغ المدفوعة بالزيادة والمستردة للزبائن.
  - `05_occ_concurrency_audit.sql`: تدقيق التعديلات المتزامنة (OCC versions) لمنع التعارض.
- `dashboards/delish-executive-bi.json`: لوحة التحكم التنفيذية بصيغة JSON قابلة للاستيراد مباشرة في Metabase.

## طريقة التشغيل والربط

### 1. تشغيل الحاوية محلياً:

```bash
docker compose -f metabase/docker-compose.metabase.yml up -d
```

ثم فتح المتصفح على: `http://localhost:3000`

### 2. الربط بقاعدة بيانات Supabase:

- **Host**: `aws-0-eu-central-1.pooler.supabase.com`
- **Port**: `6543`
- **Database name**: `postgres`
- **SSL**: مُفعل (`Require SSL`)
