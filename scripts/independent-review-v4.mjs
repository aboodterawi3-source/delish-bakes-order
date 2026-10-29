import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Independent local inspection. Auth/Storage are represented, not live Supabase.
// API object grants model the legacy Supabase public-schema defaults.
const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
const root = process.env.DELISH_PROJECT_ROOT || process.cwd();
const result = [];
const users = {
  admin: '00000000-0000-4000-8000-000000000001',
  sales: '00000000-0000-4000-8000-000000000002',
  kitchen: '00000000-0000-4000-8000-000000000003',
  social: '00000000-0000-4000-8000-000000000004',
  unassigned: '00000000-0000-4000-8000-000000000005',
};

async function actor(role, uid, fn) {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
  }
}

async function check(kind, name, fn) {
  try {
    const evidence = await fn();
    result.push({ kind, name, verified: true, evidence });
  } catch (e) {
    result.push({ kind, name, verified: false, error: e.message, code: e.code });
    process.exitCode = 1;
  }
  console.log(JSON.stringify(result.at(-1)));
}

async function mustReject(fn, pattern) {
  try {
    await fn();
  } catch (e) {
    if (pattern) assert.match(e.message, pattern);
    return { code: e.code, message: e.message };
  }
  throw Error('Expected rejection but operation succeeded');
}

const payload = (key) => ({
  customer_name: 'Synthetic customer',
  customer_phone: '0790000000',
  method: 'pickup',
  requested_date: '2026-11-01',
  requested_time: '14:00:00',
  client_request_id: key,
  deposit_paid: 0,
});
const lines = [{ name_ar: 'Synthetic cake', name_en: 'Synthetic cake', unit_price: 20, quantity: 1 }];

async function create(key, changes = {}, items = lines) {
  const r = await actor('authenticated', users.sales, () =>
    db.query('SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r', [
      JSON.stringify({ ...payload(key), ...changes }),
      JSON.stringify(items),
    ])
  );
  return r.rows[0].r;
}

async function itemId(id) {
  return (await db.query('SELECT id FROM public.order_items WHERE order_id=$1', [id])).rows[0].id;
}

async function pay(id, amount, key, options = {}) {
  const p = { method: 'cash', type: 'remainder', status: 'confirmed', ...options };
  return actor('authenticated', users.sales, () =>
    db.query(
      'SELECT public.record_order_payment_atomic(p_order_id=>$1,p_amount=>$2,p_payment_method=>$3,p_payment_type=>$4,p_status=>$5,p_idempotency_key=>$6) AS r',
      [id, amount, p.method, p.type, p.status, key]
    )
  );
}

async function updateItem(id, item, price, qty, version, uid = users.sales) {
  return actor('authenticated', uid, () =>
    db.query('SELECT public.update_order_item_atomic($1,$2,$3,$4,$5) AS r', [id, item, price, qty, version])
  );
}

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
  CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
  GRANT ALL ON storage.buckets,storage.objects TO anon,authenticated,service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
`);

const schema = await readFile(root + '/supabase/standalone_complete_schema.sql', 'utf8');
await check('fixed', 'Complete delivered schema executes verbatim twice with one settings row and one baseline banner', async () => {
  await db.exec(schema);
  await db.exec(schema);
  const r = await db.query(
    'SELECT (SELECT count(*)::int FROM public.store_settings) AS settings,(SELECT count(*)::int FROM public.storefront_banner) AS banners'
  );
  assert.equal(r.rows[0].settings, 1);
  assert.equal(r.rows[0].banners, 1);
  return r.rows[0];
});

for (const [role, id] of Object.entries(users)) {
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [id, role + '@synthetic.invalid']);
  if (role !== 'unassigned')
    await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2::public.app_role)', [id, role]);
}

await check('fixed', 'New keyed staff order and idempotent retry succeed', async () => {
  const a = await create('new-staff-request'),
    b = await create('new-staff-request');
  assert.equal(a.total, 20);
  assert.equal(a.id, b.id);
  assert.equal(b.is_duplicate, true);
  return { total: a.total, same_id: a.id === b.id, duplicate: b.is_duplicate };
});

await check('fixed', 'New keyed storefront order succeeds as service_role', async () => {
  const r = await actor('service_role', null, () =>
    db.query(
      'SELECT public.create_storefront_order_atomic($1::jsonb,$2::jsonb) AS r',
      [JSON.stringify({ ...payload('new-storefront-request'), payment_method: 'cash', delivery_fee: 3 }), JSON.stringify(lines)]
    )
  );
  assert.equal(r.rows[0].r.total, 23);
  return r.rows[0].r;
});

await check('fixed', 'Storefront RPC execution is removed from anon and authenticated even with legacy default grants', async () => {
  const r = await db.query(
    "SELECT has_function_privilege('anon','public.create_storefront_order_atomic(jsonb,jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','public.create_storefront_order_atomic(jsonb,jsonb)','EXECUTE') AS authenticated,has_function_privilege('service_role','public.create_storefront_order_atomic(jsonb,jsonb)','EXECUTE') AS service_role"
  );
  assert.equal(r.rows[0].anon, false);
  assert.equal(r.rows[0].authenticated, false);
  assert.equal(r.rows[0].service_role, true);
  return r.rows[0];
});

await check('fixed', 'Pending payment leaves paid balance and order version unchanged', async () => {
  const o = await create('pending-fixed');
  const r = await pay(o.id, 7, 'pending-fixed-key', { status: 'pending' });
  assert.equal(r.rows[0].r.deposit_paid, 0);
  assert.equal(r.rows[0].r.version, 1);
  return r.rows[0].r;
});

await check('fixed', '25 payment then 5 refund settles 20 total and extra refund is refused', async () => {
  const o = await create('lifecycle-fixed');
  await pay(o.id, 25, 'life-25');
  await pay(o.id, 5, 'life-ref-5', { type: 'refund' });
  const rejection = await mustReject(() => pay(o.id, 5, 'life-extra-ref', { type: 'refund' }), /exceeds allowable refund/);
  const r = await db.query('SELECT total,deposit_paid FROM public.orders WHERE id=$1', [o.id]);
  assert.equal(Number(r.rows[0].deposit_paid), 20);
  return { ...r.rows[0], rejection };
});

await check('fixed', 'Payment reuse on same order deduplicates; changed amount and other order are refused', async () => {
  const a = await create('idem-a'),
    b = await create('idem-b');
  await pay(a.id, 5, 'shared-payment-key');
  const same = await pay(a.id, 5, 'shared-payment-key');
  assert.equal(same.rows[0].r.is_duplicate, true);
  const amount = await mustReject(() => pay(a.id, 6, 'shared-payment-key'), /Idempotency key conflict/);
  const order = await mustReject(() => pay(b.id, 5, 'shared-payment-key'), /Idempotency key conflict/);
  return { duplicate: true, amount, order };
});

await check('fixed', 'Kitchen cannot read raw orders or raw order_items', async () => {
  return actor('authenticated', users.kitchen, async () => {
    const a = await db.query('SELECT id FROM public.orders'),
      b = await db.query('SELECT unit_price FROM public.order_items');
    assert.equal(a.rows.length, 0);
    assert.equal(b.rows.length, 0);
    return { orders: a.rows.length, items: b.rows.length };
  });
});

await check('fixed', 'Kitchen cannot reactivate cancelled completed delivered or dispatched order', async () => {
  const o = await create('terminal-fixed');
  const rejections = [];
  for (const status of ['cancelled', 'completed', 'delivered', 'out_for_delivery']) {
    await db.query('UPDATE public.orders SET status=$2::public.order_status WHERE id=$1', [o.id, status]);
    rejections.push(
      await mustReject(
        () => actor('authenticated', users.kitchen, () => db.query("SELECT public.update_kitchen_order_status($1,'ready')", [o.id])),
        /Kitchen cannot modify finalized order/
      )
    );
  }
  return rejections;
});

await check('fixed', 'Price and discount RPCs recalculate totals and reject explicit stale version', async () => {
  const o = await create('rpc-atomic-fixed'),
    i = await itemId(o.id);
  const a = await updateItem(o.id, i, 30, 1, 1);
  assert.equal(a.rows[0].r.total, 30);
  assert.equal(a.rows[0].r.version, 2);
  const stale = await mustReject(() => updateItem(o.id, i, 35, 1, 1), /OCC_VERSION_MISMATCH/);
  const b = await actor('authenticated', users.admin, () =>
    db.query('SELECT public.apply_order_discount_atomic($1,5,16.67,2) AS r', [o.id])
  );
  assert.equal(b.rows[0].r.total, 25);
  assert.equal(b.rows[0].r.version, 3);
  return { price_total: 30, discount_total: 25, version: 3, stale };
});

await check('fixed', 'Direct ledger insertion by sales is rejected by RLS', async () => {
  const o = await create('ledger-insert-blocked');
  return mustReject(
    () => actor('authenticated', users.sales, () => db.query('INSERT INTO public.order_payments(order_id,amount) VALUES($1,5)', [o.id])),
    /row-level security/
  );
});

await check('verified_fixed', 'Direct UPDATE of sensitive order columns is strictly rejected by security trigger', async () => {
  const o = await create('unprotected-order-columns');
  const rejection = await mustReject(
    () => actor('authenticated', users.sales, () =>
      db.query("UPDATE public.orders SET deposit_paid=1234,original_items='[]',modifications='[]' WHERE id=$1", [o.id])
    ),
    /Direct UPDATE of sensitive order columns/
  );
  const n = await db.query('SELECT count(*)::int AS n FROM public.order_payments WHERE order_id=$1', [o.id]);
  assert.equal(n.rows[0].n, 0);
  return { rejection, ledger_rows: n.rows[0].n };
});

await check('verified_fixed', 'Sales without discount permission is rejected by discount RPC', async () => {
  await db.query('INSERT INTO public.staff_permissions(user_id,allow_custom_discount,max_discount_percent) VALUES($1,false,0)', [users.sales]);
  const o = await create('discount-auth-bypass');
  const rejection = await mustReject(
    () => actor('authenticated', users.sales, () =>
      db.query('SELECT public.apply_order_discount_atomic($1,20,100,1) AS r', [o.id])
    ),
    /غير مصرّح: لا تملك صلاحية تطبيق الخصم/
  );
  return { rejection };
});

await check('verified_fixed', 'Item RPC enforces per-product price-edit denial', async () => {
  const p = (await db.query("INSERT INTO public.products(name_ar,name_en,slug,category,price) VALUES('Locked cake','Locked cake','locked-audit-cake','Cake',20) RETURNING id")).rows[0].id;
  await db.query('INSERT INTO public.sales_product_permissions(user_id,product_id,can_edit_price) VALUES($1,$2,false)', [users.sales, p]);
  const o = await create('product-price-auth-bypass', {}, [{ ...lines[0], product_id: p }]),
    i = await itemId(o.id);
  const rejection = await mustReject(
    () => updateItem(o.id, i, 1, 1, 1),
    /غير مصرّح: لا تملك صلاحية تعديل سعر هذا المنتج/
  );
  return { rejection };
});

await check('verified_fixed', 'Kitchen RPC sanitizes item modifications without leaking prices', async () => {
  const o = await create('kitchen-price-leak'),
    i = await itemId(o.id);
  await updateItem(o.id, i, 30, 1, 1);
  const r = await actor('authenticated', users.kitchen, () =>
    db.query('SELECT modifications FROM public.get_kitchen_orders() WHERE id=$1', [o.id])
  );
  const m = r.rows[0].modifications[0];
  assert.match(m.field, /تعديل صنف/);
  assert.equal(m.newValue.includes('30.00'), false);
  assert.equal(m.newValue.includes('د.أ'), false);
  assert.match(m.newValue, /\*\*\* \(كمية: 1\)/);
  return m;
});

await check('verified_fixed', 'Free-text phone numbers and baseline amounts are strictly masked in kitchen RPC', async () => {
  const o = await create('kitchen-baseline-leak', {
    notes: 'Contact 0790000000',
    modifications: [{ field: 'النسخة الأصلية للطلب', oldValue: '0790000000', newValue: 'الإجمالي 20.00 د.أ والعربون 5.00 د.أ', updatedAt: '2026-10-29T13:00:00Z' }],
  });
  const r = await actor('authenticated', users.kitchen, () =>
    db.query('SELECT notes,modifications FROM public.get_kitchen_orders() WHERE id=$1', [o.id])
  );
  assert.equal(r.rows[0].notes, 'Contact ***');
  assert.equal(r.rows[0].modifications[0].oldValue, '***');
  assert.equal(r.rows[0].modifications[0].newValue, '***');
  return r.rows[0];
});

await check('verified_fixed', 'Stale expected version is rejected by OCC check in item RPC', async () => {
  const o = await create('null-occ-path'),
    i = await itemId(o.id);
  await updateItem(o.id, i, 20, 3, 1);
  const rejection = await mustReject(
    () => updateItem(o.id, i, 25, 1, 1),
    /OCC_VERSION_MISMATCH/
  );
  return { rejection };
});

await check('verified_fixed', 'Stale version in order finish is rejected by OCC conflict check', async () => {
  const o = await create('self-conflict'),
    i = await itemId(o.id);
  await updateItem(o.id, i, 25, 1, 1);
  return mustReject(
    () => actor('authenticated', users.sales, () => db.query("SELECT public.patch_sales_order_atomic($1,'{\"notes\":\"my other draft\"}'::jsonb,'[]'::jsonb,$2,1)", [o.id, users.sales])),
    /conflict/
  );
});

await check('verified_fixed', 'Social-only caller is authorized by item RPC', async () => {
  const o = await create('social-regression'),
    i = await itemId(o.id);
  const r = await updateItem(o.id, i, 20, 1, 1, users.social);
  assert.equal(r.rows[0].r.total, 20);
  return r.rows[0].r;
});

await check('verified_fixed', 'Second full payment on already settled order is rejected', async () => {
  const o = await create('quick-collection');
  await pay(o.id, 20, 'quick-key-1', { type: 'full' });
  const rejection = await mustReject(
    () => pay(o.id, 20, 'quick-key-2', { type: 'full' }),
    /الطلب مدفوع بالكامل مسبقاً/
  );
  const r = await db.query('SELECT total,deposit_paid FROM public.orders WHERE id=$1', [o.id]);
  assert.equal(Number(r.rows[0].deposit_paid), 20);
  return { ...r.rows[0], rejection };
});

await check('verified_fixed', 'Payment idempotency key conflict rejects changed status or payment method', async () => {
  const o = await create('status-key-mismatch');
  await pay(o.id, 7, 'pending-promote', { status: 'pending', method: 'cash' });
  const rejection = await mustReject(
    () => pay(o.id, 7, 'pending-promote', { status: 'confirmed', method: 'visa' }),
    /Idempotency key conflict/
  );
  return { rejection };
});

await check('verified_fixed', 'Authenticated nonstaff user is rejected by staff audit RPC', async () => {
  return mustReject(
    () => actor('authenticated', users.unassigned, () =>
      db.query("SELECT public.record_staff_audit(NULL,NULL,'Forged staff','forged_audit')")
    ),
    /غير مصرّح: لا تملك صلاحية تسجيل سجلات التدقيق/
  );
});

await check('verified_fixed', 'Storefront banner remains stable without duplicates on repeated seed execution', async () => {
  const seed = await readFile(root + '/supabase/seed_initial_store.sql', 'utf8');
  await db.exec(seed);
  await db.exec(seed);
  const r = await db.query('SELECT count(*)::int AS banners FROM public.storefront_banner');
  assert.equal(r.rows[0].banners, 1);
  return r.rows[0];
});

await writeFile(root + '/independent-review-v4-results.json', JSON.stringify({ environment: 'PostgreSQL/PGlite with represented Auth, Storage and legacy default grants. No live Supabase or real parallel-connection test.', result }, null, 2));
await db.close();
console.log("\nReview V4 script finished.");
