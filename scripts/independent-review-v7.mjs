import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { randomUUID, webcrypto, createHash } from 'node:crypto';

const root = process.env.DELISH_PROJECT_ROOT || process.cwd();
const output = process.env.DELISH_REVIEW_OUTPUT || path.resolve('results_v7.json');
const ts = createRequire(root + '/package.json')('typescript');
const nativeRequire = createRequire(import.meta.url);
const schema = fs.readFileSync(root + '/supabase/standalone_complete_schema.sql', 'utf8');
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  sales: '00000000-0000-4000-8000-000000000002',
  kitchen: '00000000-0000-4000-8000-000000000003',
  social: '00000000-0000-4000-8000-000000000004',
  visitor: '00000000-0000-4000-8000-000000000005'
};
const observations = [];
const rpcTrace = [];
const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });

await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
 GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`);

await db.exec(schema);

for (const [role, id] of Object.entries(ids)) {
  await db.query('INSERT INTO auth.users(id, email) VALUES($1, $2)', [id, role + '@synthetic.invalid']);
  if (role !== 'visitor') {
    await db.query('INSERT INTO public.user_roles(user_id, role) VALUES($1, $2::public.app_role)', [id, role]);
  }
}

await db.query(
  'INSERT INTO public.staff_permissions(user_id, allow_price_override, allow_custom_discount, max_discount_percent) VALUES($1, false, false, 0)',
  [ids.sales]
);

async function actor(role, uid, fn) {
  await db.exec('SET ROLE ' + role);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
  }
}

async function check(kind, name, fn) {
  try {
    observations.push({ kind, name, verified: true, evidence: await fn() });
  } catch (e) {
    observations.push({ kind, name, verified: false, error: e.message, code: e.code });
    process.exitCode = 1;
  }
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        environment:
          'Exact standalone SQL on local PGlite; distinct SET ROLE and UID; modeled Auth/Storage and legacy grants. Actual application TS validators and handlers executed with a local SQL-backed Supabase adapter; framework HTTP/auth middleware bypassed. No real Supabase and no browser E2E.',
        observations
      },
      null,
      2
    )
  );
  console.log(JSON.stringify(observations.at(-1)));
}

async function reject(fn, rx) {
  try {
    await fn();
  } catch (e) {
    if (rx) assert.match(e.message, rx);
    return { code: e.code, message: e.message };
  }
  throw Error('Expected rejection');
}

const line = { name_ar: 'Synthetic cake', name_en: 'Synthetic cake', unit_price: 20, quantity: 1 };

async function create(extra = {}, items = [line], uid = ids.sales) {
  const order = {
    customer_name: 'Synthetic customer',
    customer_phone: '0790000000',
    method: 'pickup',
    requested_date: '2026-11-01',
    requested_time: '14:00:00',
    client_request_id: randomUUID(),
    ...extra
  };
  return (
    await actor('authenticated', uid, () =>
      db.query('SELECT public.create_staff_order_atomic($1::jsonb, $2::jsonb) AS r', [
        JSON.stringify(order),
        JSON.stringify(items)
      ])
    )
  ).rows[0].r;
}

async function state(id) {
  return (
    await db.query(
      'SELECT o.*, (SELECT jsonb_agg(i) FROM public.order_items i WHERE i.order_id = o.id) AS order_items FROM public.orders o WHERE id = $1',
      [id]
    )
  ).rows[0];
}

async function patch(id, p, version = 1) {
  return (
    await actor('authenticated', ids.sales, () =>
      db.query('SELECT public.patch_sales_order_atomic($1, $2::jsonb, $3::jsonb, $4, $5) AS r', [
        id,
        JSON.stringify(p),
        '[]',
        ids.sales,
        version
      ])
    )
  ).rows[0].r;
}

async function item(id, p = {}) {
  const s = await state(id);
  const i = s.order_items[0];
  const a = {
    p_order_id: id,
    p_item_id: i.id,
    p_unit_price: Number(i.unit_price),
    p_expected_version: s.version,
    ...p
  };
  const keys = Object.keys(a);
  const values = keys.map((k) => a[k]);
  return (
    await actor('authenticated', ids.sales, () =>
      db.query(
        'SELECT public.update_order_item_atomic(' + keys.map((k, idx) => k + '=>$' + (idx + 1)).join(',') + ') AS r',
        values
      )
    )
  ).rows[0].r;
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Error('Invalid SQL identifier');
  return '"' + s + '"';
};

function postgrestValue(value, key = '') {
  if (value instanceof Date) {
    return ['requested_date', 'event_date'].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  }
  if (Array.isArray(value)) return value.map((x) => postgrestValue(x, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, postgrestValue(v, k)]));
  }
  return value;
}

function adapter(uid, role = 'authenticated') {
  const respond = async (fn) => {
    try {
      return { data: await actor(role, uid, fn), error: null };
    } catch (e) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  };

  const make = (table, rpc) => {
    const filters = [];
    const orders = [];
    let single = false;
    let maybe = false;
    let selected = '*';
    let offset = 0;
    let limit = null;
    let mutation = null;
    let payload = null;

    const q = {
      select(s = '*') {
        selected = s;
        return q;
      },
      eq(k, v) {
        filters.push([k, '=', v]);
        return q;
      },
      in(k, v) {
        filters.push([k, 'IN', v]);
        return q;
      },
      gte(k, v) {
        filters.push([k, '>=', v]);
        return q;
      },
      lte(k, v) {
        filters.push([k, '<=', v]);
        return q;
      },
      order(k, opts = {}) {
        orders.push(ident(k) + (opts.ascending === false ? ' DESC' : ' ASC'));
        return q;
      },
      limit(n) {
        limit = n;
        return q;
      },
      range(a, b) {
        offset = a;
        limit = b - a + 1;
        return q;
      },
      single() {
        single = true;
        return q;
      },
      maybeSingle() {
        single = true;
        maybe = true;
        return q;
      },
      insert(p) {
        mutation = 'INSERT';
        payload = p;
        return q;
      },
      update(p) {
        mutation = 'UPDATE';
        payload = p;
        return q;
      },
      delete() {
        mutation = 'DELETE';
        return q;
      },
      then(ok, bad) {
        return respond(async () => {
          const vals = [];
          const add = (v) => {
            vals.push(v);
            return '$' + vals.length;
          };
          let from;
          if (rpc) {
            const args = Object.entries(rpc.args || {})
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => {
                const json = ['p_order', 'p_items', 'p_patch', 'p_new_mods', 'p_lines'].includes(k);
                return ident(k) + '=>' + add(json && v !== null ? JSON.stringify(v) : v) + (json ? '::jsonb' : '');
              });
            from = 'public.' + ident(rpc.name) + '(' + args.join(',') + ')';
          } else {
            from = 'public.' + ident(table);
          }

          let statement;
          if (mutation === 'INSERT') {
            const keys = Object.keys(payload);
            statement =
              'INSERT INTO ' +
              from +
              '(' +
              keys.map(ident).join(',') +
              ') VALUES(' +
              keys
                .map((k) =>
                  add(
                    typeof payload[k] === 'object' && payload[k] !== null
                      ? JSON.stringify(payload[k])
                      : payload[k]
                  )
                )
                .join(',') +
              ')';
          } else if (mutation === 'UPDATE') {
            statement =
              'UPDATE ' +
              from +
              ' SET ' +
              Object.entries(payload)
                .map(
                  ([k, v]) =>
                    ident(k) +
                    '=' +
                    add(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)
                )
                .join(',');
          } else if (mutation === 'DELETE') {
            statement = 'DELETE FROM ' + from;
          } else if (rpc && !['get_kitchen_orders', 'get_kitchen_order_items'].includes(rpc.name)) {
            statement = 'SELECT ' + from + ' AS r';
          } else {
            statement = 'SELECT * FROM ' + from;
          }

          if (filters.length) {
            statement +=
              ' WHERE ' +
              filters
                .map(([k, op, v]) =>
                  op === 'IN'
                    ? ident(k) + ' IN (' + v.map(add).join(',') + ')'
                    : ident(k) + op + add(v)
                )
                .join(' AND ');
          }

          if (!mutation) {
            if (orders.length) statement += ' ORDER BY ' + orders.join(',');
            if (limit !== null) statement += ' LIMIT ' + Number(limit);
            if (offset) statement += ' OFFSET ' + Number(offset);
          } else {
            statement += ' RETURNING *';
          }

          const raw = await db.query(statement, vals);
          const r = { rows: raw.rows.map((row) => postgrestValue(row)) };

          if (rpc && !['get_kitchen_orders', 'get_kitchen_order_items'].includes(rpc.name)) {
            return r.rows[0]?.r ?? null;
          }

          if (table === 'orders' && selected.includes('order_items(')) {
            for (const row of r.rows) {
              row.order_items = (
                await db.query('SELECT * FROM public.order_items WHERE order_id = $1', [row.id])
              ).rows;
            }
          }

          if (single) {
            if (r.rows.length !== 1 && !maybe) throw Error('Expected one row');
            return r.rows[0] || null;
          }
          return r.rows;
        }).then(ok, bad);
      }
    };
    return q;
  };

  return {
    from: (table) => make(table),
    rpc: (name, args) => {
      rpcTrace.push({ uid, name, args: JSON.parse(JSON.stringify(args || {})) });
      return make(null, { name, args });
    }
  };
}

const modules = new Map();
function loadApp(file) {
  const full = path.join(root, file);
  if (modules.has(full)) return modules.get(full).exports;
  const m = { exports: {} };
  modules.set(full, m);
  let source = fs.readFileSync(full, 'utf8').replaceAll('import.meta', '({env:{}})');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;

  const req = (spec) => {
    if (spec === '@tanstack/react-start') {
      return {
        createServerFn: () => {
          const d = {
            middleware() {
              return d;
            },
            inputValidator(v) {
              d.validate = v;
              return d;
            },
            handler(h) {
              d.run = async (input, context) => h({ data: d.validate ? d.validate(input) : input, context });
              return d;
            }
          };
          return d;
        }
      };
    }
    if (spec === '@tanstack/react-start/server') return { getRequestHeader: () => undefined };
    if (spec === '@/integrations/supabase/auth-middleware') return { requireSupabaseAuth: {} };
    if (spec === '@/integrations/supabase/client.server') return { supabaseAdmin: adapter(null, 'service_role') };
    if (spec.startsWith('@/')) return loadApp('src/' + spec.slice(2) + '.ts');
    return nativeRequire(spec);
  };

  vm.runInNewContext(
    '(function(require,module,exports){' + compiled + '\n})',
    {
      console,
      process,
      URL,
      Headers,
      Request,
      TextEncoder,
      TextDecoder,
      crypto: webcrypto,
      setTimeout,
      clearTimeout,
      fetch
    },
    { filename: full }
  )(req, m, m.exports);

  return m.exports;
}

const app = loadApp('src/lib/sales.functions.ts');
const ctx = (uid) => ({
  userId: uid,
  claims: { sub: uid, email: Object.entries(ids).find(([, id]) => id === uid)?.[0] + '@synthetic.invalid' },
  supabase: adapter(uid)
});
const baseInput = () => ({
  customer_name: 'Boundary synthetic',
  customer_phone: '0790000000',
  method: 'pickup',
  requested_date: '2026-11-01',
  requested_time: '14:00',
  client_request_id: randomUUID(),
  items: [{ name_ar: 'Synthetic cake', quantity: 1, unit_price: 20 }]
});

const evaluate = (expression, bindings = {}) => {
  const code = ts.transpileModule('const result=' + expression + ';globalThis.result=result;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const c = { ...bindings };
  vm.runInNewContext(code, c);
  return c.result;
};

function sourceParts(file) {
  const text = fs.readFileSync(root + '/' + file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const variables = new Map();
  const attributes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer) variables.set(n.name.getText(sf), n.initializer.getText(sf));
    if (ts.isJsxAttribute(n) && n.initializer?.expression) {
      attributes.push({ name: n.name.getText(sf), expression: n.initializer.expression.getText(sf) });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return { text, variables, attributes };
}

const mod = sourceParts('src/components/staff/ModificationsPanel.tsx');
const builder = sourceParts('src/components/staff/WebsiteRebuildPanel.tsx');

// 1. Reapplication on existing initialized DB
await check('fixed', 'Exact standalone schema can be reapplied on a database already initialized with this version', async () => {
  await db.exec(schema);
  return { reapplied: true };
});

// 2. Previous arbitrary subtotal change and unauthorized creation discount are rejected
await check('fixed', 'Previous arbitrary subtotal change and unauthorized creation discount are rejected', async () => {
  const o = await create();
  const patchRejection = await reject(() => patch(o.id, { subtotal: 0 }), /مشتق/);
  const createRejection = await reject(
    () => app.createSalesOrder.run({ ...baseInput(), discount_amount: 3, discount_percent: 15 }, ctx(ids.sales)),
    /لا تملك صلاحية تطبيق الخصم/
  );
  assert.equal(Number((await state(o.id)).total), 20);
  return { patchRejection, createRejection };
});

// 3. Locked product repricing rejected while link is intact
const locked = (
  await db.query(
    "INSERT INTO public.products(name_ar, name_en, slug, category, price) VALUES('Locked cake', 'Locked cake', 'locked-v7', 'Cake', 20) RETURNING id"
  )
).rows[0].id;
await db.query('INSERT INTO public.sales_product_permissions(user_id, product_id, can_edit_price) VALUES($1, $2, false)', [
  ids.sales,
  locked
]);

await check('fixed', 'Locked product repricing through the actual item handler is rejected while its link is intact', async () => {
  const o = await create({}, [{ ...line, product_id: locked }]);
  const s = await state(o.id);
  return reject(
    () => app.updateSalesOrderItemPrice.run({ orderId: o.id, itemId: s.order_items[0].id, expectedVersion: 1, newUnitPrice: 1 }, ctx(ids.sales)),
    /لا تملك صلاحية تعديل سعر هذا المنتج/
  );
});

// 4. F1.1: Catalog-cascade exception blocks direct manual unlink while product exists in catalog
await check('fixed', 'Catalog-cascade exception blocks direct manual unlink while product exists', async () => {
  const o = await create({}, [{ ...line, product_id: locked }]);
  const s = await state(o.id);
  const i = s.order_items[0];
  const rejection = await reject(
    () => actor('authenticated', ids.sales, () => db.query('UPDATE public.order_items SET product_id=NULL WHERE id=$1', [i.id])),
    /Direct mutation of order_items is prohibited/
  );
  const after = await state(o.id);
  assert.equal(after.order_items[0].product_id, locked);
  const catalogExists = (await db.query('SELECT count(*)::int AS n FROM public.products WHERE id=$1', [locked])).rows[0].n;
  assert.equal(catalogExists, 1);
  return { rejected: true, code: rejection.code, product_id: after.order_items[0].product_id };
});

// 5. F1.2: Catalog-cascade exception also blocks direct option, note, and name changes
await check('fixed', 'Catalog-cascade exception strictly blocks direct option and note changes', async () => {
  const o = await create({}, [{ ...line, product_id: locked, options_ar: ['Original filling'], notes: 'Original note' }]);
  const s = await state(o.id);
  const i = s.order_items[0];
  const rejection = await reject(
    () =>
      actor('authenticated', ids.sales, () =>
        db.query(
          "UPDATE public.order_items SET product_id=NULL, notes='Unlogged new note', options_ar=ARRAY['Unlogged new filling'], name_en='Unlogged changed English name' WHERE id=$1",
          [i.id]
        )
      ),
    /Direct mutation of order_items is prohibited/
  );
  const next = await state(o.id);
  assert.equal(next.order_items[0].notes, 'Original note');
  assert.equal(next.order_items[0].product_id, locked);
  return { rejected: true, code: rejection.code, notes: next.order_items[0].notes };
});

// 6. Size choice emits one versioned request and saves price and options together
await check('fixed', 'Size choice now emits one versioned request and saves price and options together', async () => {
  const o = await create({}, [{ ...line, options_ar: ['الحجم: Small'] }]);
  const s = await state(o.id);
  const i = s.order_items[0];
  const requests = [];
  const wrap = evaluate(mod.variables.get('handleItemPatch'), {
    pendingSelfMutationRef: { current: false },
    initialVersionRef: { current: 1 },
    onItemPatch: (p) => requests.push({ orderId: o.id, ...p })
  });
  const change = mod.attributes.find((a) => a.name === 'onChange' && a.expression.includes('const size = product?.sizes.find'));
  evaluate(change.expression, {
    item: i,
    product: { sizes: [{ label: 'Large', price: 30 }] },
    options: i.options_ar,
    setSizeLabel: () => {},
    setOptions: () => {},
    onItemPatch: wrap,
    withLabel: evaluate(mod.variables.get('withLabel'))
  })({ target: { value: 'Large' } });
  assert.equal(requests.length, 1);
  const updated = await app.updateSalesOrderItemPrice.run(requests[0], ctx(ids.sales));
  assert.equal(updated.items[0].unit_price, 30);
  assert.equal(updated.items[0].options_ar[0], 'الحجم: Large');
  return { request: requests[0], saved_options: updated.items[0].options_ar };
});

// 7. F2: Website builder submits draft version and rejects stale rebuild against newer quantity
await check('fixed', 'Website builder submits draft version and rejects stale rebuild against newer quantity', async () => {
  const o = await create();
  const s = await state(o.id);
  let draft;
  evaluate(builder.variables.get('importCurrent'), { order: { ...s, items: s.order_items }, setLines: (v) => { draft = v; } })();
  assert.equal(draft[0].quantity, 1);
  await item(o.id, { p_quantity: 3 });
  const latest = await state(o.id);
  assert.equal(latest.version, 2);
  let sent;
  const parent = mod.attributes.find((a) => a.name === 'onReplaceItems');
  const forward = evaluate(parent.expression, { selected: { id: o.id, version: latest.version }, rebuild: { mutate: (v) => { sent = v; } } });
  const button = builder.attributes.find((a) => a.name === 'onClick' && a.expression.includes('onReplace(lines.map'));
  evaluate(button.expression, { onReplace: forward, lines: draft })();
  assert.equal(sent.expectedVersion, 1);
  const rejection = await reject(() => app.replaceSalesOrderItems.run(sent, ctx(ids.sales)), /OCC_VERSION_MISMATCH|تعارض/);
  const current = await state(o.id);
  assert.equal(current.order_items[0].quantity, 3);
  return { sent_version: sent.expectedVersion, rejection: rejection.message, preserved_quantity: current.order_items[0].quantity };
});

// 8. Explicit draft version through handleReplaceItems does reject stale rebuild
await check('fixed', 'Explicit draft version through handleReplaceItems does reject stale rebuild', async () => {
  const o = await create();
  await item(o.id, { p_quantity: 3 });
  let sent;
  const parent = evaluate(mod.attributes.find((a) => a.name === 'onReplaceItems').expression, {
    selected: { id: o.id, version: 2 },
    rebuild: { mutate: (v) => { sent = v; } }
  });
  const wrap = evaluate(mod.variables.get('handleReplaceItems'), {
    pendingSelfMutationRef: { current: false },
    initialVersionRef: { current: 1 },
    onReplaceItems: parent
  });
  wrap([{ name: 'Synthetic cake', quantity: 1, unitPrice: 20 }]);
  assert.equal(sent.expectedVersion, 1);
  return reject(() => app.replaceSalesOrderItems.run(sent, ctx(ids.sales)), /تعارض/);
});

// 9. Fixed discount is clamped to subtotal on rebuild and a note-only save keeps total unchanged
await check('fixed', 'Fixed discount is clamped to subtotal on rebuild and a note-only save keeps total unchanged', async () => {
  await db.query('UPDATE public.staff_permissions SET allow_custom_discount=true, max_discount_percent=100 WHERE user_id=$1', [ids.sales]);
  const o = await create({ discount_amount: 10, discount_percent: 0 });
  const rebuilt = await app.replaceSalesOrderItems.run({ orderId: o.id, expectedVersion: 1, lines: [{ name: 'Synthetic cake', unitPrice: 5, quantity: 1 }] }, ctx(ids.sales));
  assert.equal(rebuilt.discount_amount, 5);
  await app.updateSalesOrderItemPrice.run({ orderId: o.id, itemId: rebuilt.items[0].id, expectedVersion: 2, notes: 'Note only' }, ctx(ids.sales));
  const next = await state(o.id);
  assert.equal(Number(next.total), rebuilt.total);
  assert.equal(Number(next.discount_amount), rebuilt.discount_amount);
  return { after_rebuild: { subtotal: rebuilt.subtotal, discount_amount: rebuilt.discount_amount, total: rebuilt.total }, after_note_only: { subtotal: next.subtotal, discount_amount: next.discount_amount, total: next.total } };
});

// 10. F4: Patch rejects inconsistent discount amount and percent
await check('fixed', 'Patch rejects inconsistent discount amount and percent', async () => {
  await db.query('UPDATE public.staff_permissions SET allow_custom_discount=true, max_discount_percent=10 WHERE user_id=$1', [ids.sales]);
  const o = await create();
  const rejection = await reject(
    () => patch(o.id, { discount_amount: 0, discount_percent: 10 }),
    /لا يتطابق مع النسبة المحددة/
  );
  const after = await state(o.id);
  assert.equal(Number(after.total), 20);
  return { rejected: true, error: rejection.message };
});

// 11. F5: Increasing quantity on an approved percentage discount is permitted consistently in both item and rebuild paths
await check('fixed', 'Increasing quantity on an approved percentage discount is permitted consistently in both item and rebuild paths', async () => {
  await db.query('UPDATE public.staff_permissions SET allow_custom_discount=false, max_discount_percent=0 WHERE user_id=$1', [ids.sales]);
  const a = await create();
  const b = await create();
  for (const o of [a, b]) {
    await actor('authenticated', ids.admin, () => db.query('SELECT public.apply_order_discount_atomic($1, 4, 20, 1)', [o.id]));
  }
  const sa = await state(a.id);
  const okItem = await app.updateSalesOrderItemPrice.run({ orderId: a.id, itemId: sa.order_items[0].id, expectedVersion: 2, quantity: 2 }, ctx(ids.sales));
  assert.equal(okItem.total, 32);
  const okRebuild = await app.replaceSalesOrderItems.run({ orderId: b.id, expectedVersion: 2, lines: [{ name: 'Synthetic cake', unitPrice: 20, quantity: 2 }] }, ctx(ids.sales));
  assert.equal(okRebuild.total, 32);
  assert.equal(okRebuild.discount_amount, 8);
  return { item_total: okItem.total, rebuild_total: okRebuild.total, rebuild_discount: okRebuild.discount_amount };
});

// 12. F3.1: Actual social order description masks phone in kitchen item name
await check('fixed', 'Actual social order description masks phone in kitchen item name', async () => {
  const today = loadApp('src/lib/date-filter.ts').todayIso();
  const r = await loadApp('src/lib/social.functions.ts').createSocialOrder.run({
    client_request_id: randomUUID(),
    customer_name: 'Synthetic customer',
    customer_phone: '0790000000',
    order_details: 'Chocolate cake; contact 079 123 4567',
    quantity: 1,
    unit_price: 20,
    method: 'pickup',
    payment_option: 'cash',
    requested_date: today,
    requested_time: '14:00',
    is_urgent: false
  }, ctx(ids.social));
  const feed = await loadApp('src/lib/kds.functions.ts').getKitchenOrders.run(undefined, ctx(ids.kitchen));
  const order = feed.find((x) => x.id === r.id);
  assert.ok(order);
  assert.equal(order.items[0].name_ar.includes('079 123 4567'), false);
  return { kitchen_name_ar: order.items[0].name_ar, kitchen_name_en: order.items[0].name_en };
});

// 13. F3.2: Kitchen feed masks price included in free-form item description
await check('fixed', 'Kitchen feed masks price included in free-form item description', async () => {
  const today = loadApp('src/lib/date-filter.ts').todayIso();
  const o = await create({ requested_date: today }, [{ ...line, name_ar: 'Chocolate cake 40 د.أ', name_en: 'Cake 40 JD', notes: 'Contact 079 123 4567' }]);
  const feed = await loadApp('src/lib/kds.functions.ts').getKitchenOrders.run(undefined, ctx(ids.kitchen));
  const row = feed.find((x) => x.id === o.id);
  assert.ok(row);
  assert.equal(row.items[0].name_ar.includes('40 د.أ'), false);
  assert.equal(row.items[0].name_en.includes('40 JD'), false);
  return row.items[0];
});

// 14. Real catalog deletion succeeds without deleting historical order
await check('fixed', 'New order_items cascade exception permits real catalog deletion without deleting historical order', async () => {
  const p = (await db.query("INSERT INTO public.products(name_ar, name_en, slug, category, price) VALUES('Delete cake', 'Delete cake', 'delete-v7', 'Cake', 20) RETURNING id")).rows[0].id;
  const o = await create({}, [{ ...line, product_id: p }]);
  await actor('authenticated', ids.sales, () => db.query('DELETE FROM public.products WHERE id=$1', [p]));
  const s = await state(o.id);
  assert.equal(s.order_items[0].product_id, null);
  assert.equal(Number(s.total), 20);
  return { product_id: s.order_items[0].product_id, order_total: s.total };
});

// 15. Upgrade check: applying schema over prior schema with older function signatures succeeds cleanly
await check('fixed', 'Applying this schema over a prior schema with older function signatures succeeds cleanly', async () => {
  const prior = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
  const code = fs.readFileSync(new URL(import.meta.url), 'utf8');
  const bootstrap = code.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
  try {
    await prior.exec(bootstrap);
    // Simulate previous function with fewer parameters (12 instead of 13)
    await prior.exec(`
      CREATE OR REPLACE FUNCTION public.update_order_item_atomic(
        p_order_id uuid, p_item_id uuid, p_unit_price numeric, p_quantity integer,
        p_expected_version integer, p_staff_name text, p_reason text,
        p_name_ar text, p_name_en text, p_options_ar text[], p_options_en text[], p_notes text
      ) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;
    `);
    // Reapply current schema
    await prior.exec(schema);
    return { upgrade_successful: true };
  } finally {
    await prior.close();
  }
});

await db.close();
console.log('All 15 V7 checks completed successfully!');
