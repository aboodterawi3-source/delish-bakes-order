# Delish Cake & Bake — Deployment Runbook & Operating Guide
# دليل تشغيل ونشر مشروع مخبز وحلويات ديليش

هذا الدليل يوضح الخطوات المعتمدة لتأسيس وتشغيل مشروع ديليش كيك محلياً وعلى بيئات الإنتاج السحابية، وترتيب تشغيل ملفات قاعدة البيانات (PostgreSQL / Supabase).

---

## 1. خطوات تأسيس قاعدة البيانات على Supabase (Database Setup Order)

يجب تنفيذ ملفات SQL الثلاثة في **SQL Editor** داخل لوحة تحكم Supabase بالترتيب الصارم التالي:

```mermaid
flowchart TD
    A["1. standalone_complete_schema.sql<br>(المخطط الكامل والجداول وسياسات RLS والدوال الذرية)"] --> B["2. seed_initial_store.sql<br>(بيانات البذور: الكتالوج، التصنيفات، البانر)"]
    B --> C["3. delish_api_permissions.sql<br>(أذونات الـ Data API الصريحة ومبدأ الامتياز الأدنى)"]
    C --> D["4. bootstrap_admin<br>(إنشاء حساب المدير وتعيين دوره الإداري)"]
```

### الخطوة 1: المخطط الشامل والسياسات والدوال الذرية
- **الملف:** [`supabase/standalone_complete_schema.sql`](./supabase/standalone_complete_schema.sql)
- **الوظيفة:** ينشئ جميع الجداول (الطلبات، الأصناف، الدفعات، رموز التعديل، سجل التدقيق)، والأنواع (`app_role`, `order_status`)، وفهارس الأداء، ودوال التحقق، وسياسات الحماية على مستوى الصفوف (RLS)، ودوال العمليات الذرية المتزامنة (`create_storefront_order_atomic`, `update_order_item_atomic`, إلخ).

### الخطوة 2: بيانات المتجر الأولية والكتالوج الافتراضي
- **الملف:** [`supabase/seed_initial_store.sql`](./supabase/seed_initial_store.sql)
- **الوظيفة:** يملأ قاعدة البيانات ببانر المتجر الافتراضي، والتصنيفات الخمسة الأساسية، والأصناف الستة الأكثر مبيعاً مع الصور والأحجام والأسعار بالدينار الأردني (JOD).

### الخطوة 3: أذونات الـ Data API الصريحة ومبدأ الامتياز الأدنى (Least Privilege)
- **الملف:** [`supabase/delish_api_permissions.sql`](./supabase/delish_api_permissions.sql)
- **الوظيفة:** **يُنفّذ فوراً بعد ملف المخطط وملف البذور**. يضبط صلاحيات `GRANT` و `REVOKE` الدقيقة على مستوى PostgREST API:
  - يمنح الزوار غير المسجلين (`anon`) صلاحية قراءة الكتالوج والبانر والتصنيفات فقط (`SELECT` على `products`, `storefront_categories`, `storefront_banner`, `store_settings`).
  - يعزل تماماً جداول الطلبات والدفعات وسجلات التدقيق والأدوار عن الزوار (`401 / 42501 permission denied`).
  - يقصر عمليات التعديل والإنشاء الحساسة على الدوال الذرية الموثوقة أو مفتاح الخادم السري (`service_role`).

---

## 2. إنشاء وتفعيل حساب المدير الأول (Admin Bootstrap)

1. من لوحة Supabase، انتقل إلى **Authentication -> Users** واضغط **Add User -> Create user**.
2. أدخل البريد: `admin@delish.local` وكلمة مرور قوية.
3. انسخ معرف المستخدم (UID) المولد.
4. نفّذ الاستعلام التالي في **SQL Editor** لربط الحساب بدور المدير ورمز الموظف 1:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('PASTE_USER_UUID_HERE'::uuid, 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.staff_codes (user_id, staff_code)
VALUES ('PASTE_USER_UUID_HERE'::uuid, 1)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.app_setup_state (id, admin_setup_completed_at)
VALUES (true, now())
ON CONFLICT (id) DO UPDATE SET admin_setup_completed_at = now();
```

---

## 3. إعداد البيئة المحلية (`.env`)

انسخ محتوى `.env.example` إلى ملف `.env` واضبط القيم:
```env
SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
PUBLIC_SITE_URL="http://localhost:3000"
VITE_SITE_URL="http://localhost:3000"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
```
> [!IMPORTANT]
> تأكد دائماً أن ملف `.env` مستثنى من Git في `.gitignore`، ولا ترفع المفتاح السري `SUPABASE_SERVICE_ROLE_KEY` إطلاقاً.

---

## 4. التشغيل والبناء (Build & Run Commands)

### التشغيل المحلي للتطوير:
```cmd
npm.cmd ci
npm.cmd run dev -- --port 3000 --strictPort
```

### فحص سلامة الأنواع والاختبارات:
```cmd
npx tsc --noEmit
npm test
```

### البناء للإنتاج:
- **نظام الحاويات / خوادم Node.js المستقلة (Docker / VPS):**
  ```cmd
  npm run build:node
  node .output/server/index.mjs
  ```
- **نظام الحوسبة السحابية الحافة (Cloudflare Pages / Workers):**
  ```cmd
  npm run build
  ```


---

## 5. المخطط المعماري للنظام وتدفق البيانات (System Architecture & Data Flow)

> **توثيق معماري معتمد** تم إنشاؤه استناداً لأدوات الهندسة المعمارية (`archify` و `diagram-design`).

يوضح المخطط التالي تدفق دورة حياة الطلب والبيانات من واجهة الزبون في المتجر وسلة الشراء إلى خادم Nitro وقاعدة بيانات Supabase، وانعكاسها اللحظي على شاشة المطبخ ودفتر الحسابات المالي:

```mermaid
flowchart TD
    subgraph ClientLayer["1. واجهة العميل والمبيعات (Client Tier)"]
        Storefront["واجهة المتجر / Kiosk\n(React 19 + TanStack Start)"]
        SlotPicker["محدد الفترات الزمنية الذكي\nTimeSlotPicker"]
        Cart["سلة الطلبات الموحدة\nCartDrawer"]
        KDS["شاشة المطبخ KDS\n/kitchen (حسب الأسبقية وتعليمات القوالب)"]
        AdminUI["لوحة الإدارة والتحليلات\n/staff?tab=analytics"]
    end

    subgraph ServerLayer["2. خادم التطبيق والدوال الآمنة (Nitro and Server Functions)"]
        NitroSSR["خادم Nitro SSR\n(Node.js / Cloudflare Workers)"]
        StorefrontRPC["دالة إنشاء الطلب الآمنة\nsubmitStorefrontOrder()"]
        KDSRPC["دالة إدارة مراحل التحضير\nupdateKitchenStage()"]
        AdminRPC["دالة التقارير المالية\ngetAdminAnalytics()"]
        AuthMiddleware["وسيط التحقق الصارم\nrequireSupabaseAuth"]
    end

    subgraph DataLayer["3. محرك البيانات والعمليات الذرية (Supabase PostgreSQL)"]
        PG[("قاعدة بيانات PostgreSQL 15\n(RLS مُفعّل بالكامل)")]
        AtomicRPC["الدوال الذرية المتزامنة (OCC)\ncreate_storefront_order_atomic()"]
        OrdersTable[("جدول الطلبات\npublic.orders")]
        ItemsTable[("جدول الأصناف والتخصيص\npublic.order_items")]
        LedgerTable[("دفتر الحسابات والتدقيق المالي\npublic.ledger_entries")]
        RealtimePub["Supabase Realtime\n(Postgres CDC WebSockets)"]
    end

    subgraph ResilienceLayer["4. بيئة المحاكاة وفحص الصلابة (QA and Resilience Tier)"]
        PGlite["محرك PGlite المحلي\n(اختبارات بدون خادم خارجي)"]
        Toxiproxy["محاكي مشاكل الشبكة\ndocker-compose.toxiproxy.yml"]
        PlaywrightCLI["أتمتة الفحص الشامل\nplaywright-cli customer journey"]
    end

    %% تدفق واجهة المتجر والطلب
    Storefront -->|"1. اختيار الأصناف وتخصيصها"| Cart
    Cart -->|"2. حجز نافذة الاستلام/التوصيل وحساب Lead Time"| SlotPicker
    Cart -->|"3. إرسال الطلب مشفراً"| NitroSSR
    NitroSSR -->|"4. استدعاء RPC مع رمز التعديل"| StorefrontRPC
    StorefrontRPC -->|"5. تنفيذ المعاملة الذرية"| AtomicRPC
    AtomicRPC -->|"6. حجز المخزون ومنع التعارض (OCC)"| OrdersTable
    AtomicRPC -->|"6. إدراج بنود الطلب"| ItemsTable
    AtomicRPC -->|"6. تسجيل القيد المالي المحمي"| LedgerTable

    %% البث اللحظي للمطبخ
    OrdersTable -.->|"7. بث حدث طلب جديد (INSERT)"| RealtimePub
    RealtimePub -.->|"8. استلام فوري للطلب مع شارة الاستعجال"| KDS
    KDS -->|"9. تحديث حالة الصنف (preparing -> ready)"| KDSRPC
    KDSRPC -->|"10. توثيق بواسطة رمز الموظف الصارم"| PG

    %% تدفق لوحة الإدارة
    AdminUI -->|"استعلام التقارير المحمية"| AuthMiddleware
    AuthMiddleware -->|"التحقق من جلسة المدير"| AdminRPC
    AdminRPC -->|"قراءة الإيرادات والمبيعات المجمعة"| PG

    %% طبقة الاختبارات
    ResilienceLayer -.->|"محاكاة ضغط وانقطاع شبكة"| StorefrontRPC
    PlaywrightCLI -.->|"اختبار رحلة العميل نحو KDS"| Storefront
```

### مخطط الكيانات والعلاقات لبيانات المتجر والمطبخ (Database ERD):

```mermaid
erDiagram
    storefront_categories ||--o{ products : "تصنيف المنتجات"
    orders ||--|{ order_items : "يحتوي بنوداً"
    orders ||--o{ order_payments : "سجل الدفعات والاسترجاع"
    orders ||--o{ audit_logs : "سجل التعديلات والتدقيق"

    storefront_categories {
        uuid id PK
        string name_ar
        string name_en
        string icon
        string image_url
        int sort_order
        boolean is_active
    }

    products {
        uuid id PK
        uuid category_id FK
        string slug
        string name_ar
        string name_en
        numeric price
        jsonb sizes
        boolean is_available
    }

    orders {
        uuid id PK
        string order_number UK
        string customer_name
        string customer_phone
        order_method method
        string area
        string address
        date requested_date
        time requested_time
        numeric subtotal
        numeric delivery_fee
        numeric total
        numeric deposit_paid
        order_status status
        int version
        string client_request_id UK
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        string name_ar
        string name_en
        numeric unit_price
        int quantity
        string[] options_ar
        string notes
    }

    order_payments {
        uuid id PK
        uuid order_id FK
        numeric amount
        payment_method payment_method
        string payment_type
        string status
        string idempotency_key UK
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        uuid order_id FK
        string order_number
        uuid staff_user_id FK
        string action
        numeric original_amount
        numeric modified_amount
        string reason
        timestamp created_at
    }
```

### معايير الأمان والمعمارية المطبقة في هذا المخطط:
1. **عزل الصلاحيات ومبدأ الامتياز الأدنى (Zero Trust / Least Privilege):**
   - العميل غير مسجل الدخول (`anon`) لا يستطيع القراءة المباشرة أو الكتابة المباشرة على جداول الطلبات أو الدفتر المالي عبر PostgREST.
   - عمليات إنشاء الطلبات تتم حصرياً عبر دالة `create_storefront_order_atomic()` التي تتحقق من سلامة الأسعار وحسابات المجموع الرياضي.
2. **التحكم بالتزامن المتفائل (Optimistic Concurrency Control - OCC):**
   - حماية تعديل الطلبات وحالات المطبخ من الكتابة المتزامنة المتضاربة عبر عمود `version` ورموز التعديل السرية (`edit_token`).
3. **التحديثات اللحظية الخفيفة (Realtime Event-Driven):**
   - شاشة المطبخ تتصل بقناة Realtime مخصصة وتستمع فقط لتغييرات الطلبات النشطة اليومية دون إعادة جلب كل البيانات (`Re-fetch`).
4. **حماية التواريخ ونوافذ الاستلام (Delivery Slots & Lead Time Engine):**
   - التحقق من زمن التحضير المطلوب (4 ساعات لقوالب الكيك الاحتفالية، ساعة للمخبوزات الجاهزة) داخل محرك `delivery-slots.ts`.
5. **سلامة دفتر الدفعات المحمي (Append-Only Financial Ledger):**
   - جدول `order_payments` لا يقبل التعديل المباشر أو الحذف إطلاقاً؛ عمليات الدفع والاسترجاع تسجل كقيود ذرية غير قابلة للإلغاء عبر `record_order_payment_atomic()`.
