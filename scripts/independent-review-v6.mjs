const dynamicToday = new Date().toISOString().slice(0, 10);
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import assert from "node:assert/strict";
import { randomUUID, webcrypto, createHash } from "node:crypto";

const root = process.env.DELISH_PROJECT_ROOT || process.cwd();
const output = process.env.DELISH_REVIEW_OUTPUT || path.resolve("results_v6.json");
const ts = createRequire(root + "/package.json")("typescript");
const nativeRequire = createRequire(import.meta.url);
const schema = fs.readFileSync(root + "/supabase/standalone_complete_schema.sql", "utf8");
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  sales: "00000000-0000-4000-8000-000000000002",
  kitchen: "00000000-0000-4000-8000-000000000003",
  social: "00000000-0000-4000-8000-000000000004",
  visitor: "00000000-0000-4000-8000-000000000005",
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
  await db.query("INSERT INTO auth.users(id, email) VALUES($1, $2)", [
    id,
    role + "@synthetic.invalid",
  ]);
  if (role !== "visitor") {
    await db.query("INSERT INTO public.user_roles(user_id, role) VALUES($1, $2::public.app_role)", [
      id,
      role,
    ]);
  }
}

await db.query(
  "INSERT INTO public.staff_permissions(user_id, allow_price_override, allow_custom_discount, max_discount_percent) VALUES($1, false, false, 0)",
  [ids.sales],
);

async function actor(role, uid, fn) {
  await db.exec("SET ROLE " + role);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
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
          "Exact standalone SQL on local PGlite; distinct SET ROLE and UID; modeled Auth/Storage and legacy grants. Actual application TS validators and handlers executed with a local SQL-backed Supabase adapter; framework HTTP/auth middleware bypassed. No real Supabase and no browser E2E.",
        observations,
      },
      null,
      2,
    ),
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
  throw Error("Expected rejection");
}

const line = { name_ar: "Synthetic cake", name_en: "Synthetic cake", unit_price: 20, quantity: 1 };

async function create(extra = {}, items = [line], uid = ids.sales) {
  const order = {
    customer_name: "Synthetic customer",
    customer_phone: "0790000000",
    method: "pickup",
    requested_date: dynamicToday,
    requested_time: "14:00:00",
    client_request_id: randomUUID(),
    ...extra,
  };
  return (
    await actor("authenticated", uid, () =>
      db.query("SELECT public.create_staff_order_atomic($1::jsonb, $2::jsonb) AS r", [
        JSON.stringify(order),
        JSON.stringify(items),
      ]),
    )
  ).rows[0].r;
}

async function state(id) {
  return (
    await db.query(
      "SELECT o.*, (SELECT jsonb_agg(i) FROM public.order_items i WHERE i.order_id = o.id) AS order_items FROM public.orders o WHERE id = $1",
      [id],
    )
  ).rows[0];
}

async function patch(id, p, version = 1) {
  return (
    await actor("authenticated", ids.sales, () =>
      db.query("SELECT public.patch_sales_order_atomic($1, $2::jsonb, $3::jsonb, $4, $5) AS r", [
        id,
        JSON.stringify(p),
        "[]",
        ids.sales,
        version,
      ]),
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
    ...p,
  };
  const keys = Object.keys(a);
  const values = keys.map((k) => a[k]);
  return (
    await actor("authenticated", ids.sales, () =>
      db.query(
        "SELECT public.update_order_item_atomic(" +
          keys.map((k, idx) => k + "=>$" + (idx + 1)).join(",") +
          ") AS r",
        values,
      ),
    )
  ).rows[0].r;
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Error("Invalid SQL identifier");
  return '"' + s + '"';
};

function postgrestValue(value, key = "") {
  if (value instanceof Date) {
    return ["requested_date", "event_date"].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  }
  if (Array.isArray(value)) return value.map((x) => postgrestValue(x, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, postgrestValue(v, k)]));
  }
  return value;
}

function adapter(uid, role = "authenticated") {
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
    let selected = "*";
    let offset = 0;
    let limit = null;
    let mutation = null;
    let payload = null;

    const q = {
      select(s = "*") {
        selected = s;
        return q;
      },
      eq(k, v) {
        filters.push([k, "=", v]);
        return q;
      },
      in(k, v) {
        filters.push([k, "IN", v]);
        return q;
      },
      gte(k, v) {
        filters.push([k, ">=", v]);
        return q;
      },
      lte(k, v) {
        filters.push([k, "<=", v]);
        return q;
      },
      order(k, opts = {}) {
        orders.push(ident(k) + (opts.ascending === false ? " DESC" : " ASC"));
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
        mutation = "INSERT";
        payload = p;
        return q;
      },
      update(p) {
        mutation = "UPDATE";
        payload = p;
        return q;
      },
      delete() {
        mutation = "DELETE";
        return q;
      },
      then(ok, bad) {
        return respond(async () => {
          const vals = [];
          const add = (v) => {
            vals.push(v);
            return "$" + vals.length;
          };
          let from;
          if (rpc) {
            const args = Object.entries(rpc.args || {})
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => {
                const json = ["p_order", "p_items", "p_patch", "p_new_mods", "p_lines"].includes(k);
                return (
                  ident(k) + "=>" + add(json ? JSON.stringify(v) : v) + (json ? "::jsonb" : "")
                );
              });
            from = "public." + ident(rpc.name) + "(" + args.join(",") + ")";
          } else {
            from = "public." + ident(table);
          }

          let statement;
          if (mutation === "INSERT") {
            const keys = Object.keys(payload);
            statement =
              "INSERT INTO " +
              from +
              "(" +
              keys.map(ident).join(",") +
              ") VALUES(" +
              keys
                .map((k) =>
                  add(
                    typeof payload[k] === "object" && payload[k] !== null
                      ? JSON.stringify(payload[k])
                      : payload[k],
                  ),
                )
                .join(",") +
              ")";
          } else if (mutation === "UPDATE") {
            statement =
              "UPDATE " +
              from +
              " SET " +
              Object.entries(payload)
                .map(
                  ([k, v]) =>
                    ident(k) +
                    "=" +
                    add(typeof v === "object" && v !== null ? JSON.stringify(v) : v),
                )
                .join(",");
          } else if (mutation === "DELETE") {
            statement = "DELETE FROM " + from;
          } else if (rpc && !["get_kitchen_orders", "get_kitchen_order_items"].includes(rpc.name)) {
            statement = "SELECT " + from + " AS r";
          } else {
            statement = "SELECT * FROM " + from;
          }

          if (filters.length) {
            statement +=
              " WHERE " +
              filters
                .map(([k, op, v]) =>
                  op === "IN"
                    ? ident(k) + " IN (" + v.map(add).join(",") + ")"
                    : ident(k) + op + add(v),
                )
                .join(" AND ");
          }

          if (!mutation) {
            if (orders.length) statement += " ORDER BY " + orders.join(",");
            if (limit !== null) statement += " LIMIT " + Number(limit);
            if (offset) statement += " OFFSET " + Number(offset);
          } else {
            statement += " RETURNING *";
          }

          const raw = await db.query(statement, vals);
          const r = { rows: raw.rows.map((row) => postgrestValue(row)) };

          if (rpc && !["get_kitchen_orders", "get_kitchen_order_items"].includes(rpc.name)) {
            return r.rows[0]?.r ?? null;
          }

          if (table === "orders" && selected.includes("order_items(")) {
            for (const row of r.rows) {
              row.order_items = (
                await db.query("SELECT * FROM public.order_items WHERE order_id = $1", [row.id])
              ).rows;
            }
          }

          if (single) {
            if (r.rows.length !== 1 && !maybe) throw Error("Expected one row");
            return r.rows[0] || null;
          }
          return r.rows;
        }).then(ok, bad);
      },
    };
    return q;
  };

  return {
    from: (table) => make(table),
    rpc: (name, args) => {
      rpcTrace.push({ uid, name, args: JSON.parse(JSON.stringify(args || {})) });
      return make(null, { name, args });
    },
  };
}

const modules = new Map();
function loadApp(file) {
  const full = path.join(root, file);
  if (modules.has(full)) return modules.get(full).exports;
  const m = { exports: {} };
  modules.set(full, m);
  let source = fs.readFileSync(full, "utf8").replaceAll("import.meta", "({env:{}})");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;

  const req = (spec) => {
    if (spec === "@tanstack/react-start") {
      return {
        createServerFn: () => {
          const d = {
            middleware() {
              return d;
            },
            validator(v) {
              d.validate = v;
              return d;
            },
            inputValidator(v) {
              d.validate = v;
              return d;
            },
            handler(h) {
              d.run = async (input, context) =>
                h({ data: d.validate ? d.validate(input) : input, context });
              return d;
            },
          };
          return d;
        },
      };
    }
    if (spec === "@tanstack/react-start/server") return { getRequestHeader: () => undefined };
    if (spec === "@/integrations/supabase/auth-middleware") return { requireSupabaseAuth: {} };
    if (spec === "@/integrations/supabase/client.server")
      return { supabaseAdmin: adapter(null, "service_role") };
    if (spec.startsWith("@/")) return loadApp("src/" + spec.slice(2) + ".ts");
    return nativeRequire(spec);
  };

  vm.runInNewContext(
    "(function(require,module,exports){" + compiled + "\n})",
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
      fetch,
    },
    { filename: full },
  )(req, m, m.exports);

  return m.exports;
}

const app = loadApp("src/lib/sales.functions.ts");
const ctx = (uid) => ({
  userId: uid,
  claims: {
    sub: uid,
    email: Object.entries(ids).find(([, id]) => id === uid)?.[0] + "@synthetic.invalid",
  },
  supabase: adapter(uid),
});
const baseInput = () => ({
  customer_name: "Boundary synthetic",
  customer_phone: "0790000000",
  method: "pickup",
  requested_date: dynamicToday,
  requested_time: "14:00",
  client_request_id: randomUUID(),
  items: [{ name_ar: "Synthetic cake", quantity: 1, unit_price: 20 }],
});

// 1. Schema reapplication test
await check("fixed", "Schema can be reapplied without syntax/definition failure", async () => {
  await db.exec(schema);
  return { reapplied: true };
});

// 2. E1.1: General patch rejects arbitrary subtotal manipulation
await check("fixed", "General patch rejects arbitrary subtotal modification", async () => {
  const o = await create();
  const e = await reject(
    () => patch(o.id, { subtotal: 0 }),
    /المجموع الفرعي مشتق من بنود الطلب ولا يمكن تعديله مباشرة/,
  );
  const s = await state(o.id);
  assert.equal(Number(s.total), 20);
  return { rejected: true, error: e.message, total: s.total };
});

// 3. E1.2: Staff creation RPC rejects unauthorized discount
await check(
  "fixed",
  "Staff creation RPC rejects discount when staff has no discount permission",
  async () => {
    const e = await reject(
      () => create({ discount_amount: 20, discount_percent: 100 }),
      /غير مصرّح: لا تملك صلاحية تطبيق الخصم|الخصم/,
    );
    return { rejected: true, error: e.message };
  },
);

// 4. E1.2: Actual createSalesOrder endpoint rejects unauthorized discount
await check(
  "fixed",
  "Actual createSalesOrder endpoint rejects discount when staff has no discount permission",
  async () => {
    const e = await reject(
      () =>
        app.createSalesOrder.run(
          { ...baseInput(), discount_amount: 3, discount_percent: 15 },
          ctx(ids.sales),
        ),
      /غير مصرّح: لا تملك صلاحية تطبيق الخصم|الخصم/,
    );
    return { rejected: true, error: e.message };
  },
);

// 5. E1.2: Actual staff-create endpoint rejects repricing locked product without permission
const product = (
  await db.query(
    "INSERT INTO public.products(name_ar, name_en, slug, category, price) VALUES('Locked cake', 'Locked cake', 'locked-v6-cake', 'Cake', 20) RETURNING id",
  )
).rows[0].id;
await db.query(
  "INSERT INTO public.sales_product_permissions(user_id, product_id, can_edit_price) VALUES($1, $2, false)",
  [ids.sales, product],
);

await check(
  "fixed",
  "Actual staff-create endpoint rejects repricing a locked product without permission",
  async () => {
    const e = await reject(
      () =>
        app.createSalesOrder.run(
          {
            ...baseInput(),
            items: [{ name_ar: "Locked cake", productId: product, quantity: 1, unit_price: 1 }],
          },
          ctx(ids.sales),
        ),
      /لا تملك صلاحية تعديل سعر هذا المنتج/,
    );
    return { rejected: true, error: e.message };
  },
);

// 6. E2: General patch stores discount_percent along with discount_amount
await check(
  "fixed",
  "General patch stores discount_percent along with discount_amount",
  async () => {
    await db.query(
      "UPDATE public.staff_permissions SET allow_custom_discount = true, max_discount_percent = 10 WHERE user_id = $1",
      [ids.sales],
    );
    const o = await create();
    await patch(o.id, { discount_amount: 2, discount_percent: 10 });
    const afterPatch = await state(o.id);
    assert.equal(Number(afterPatch.discount_amount), 2);
    assert.equal(Number(afterPatch.discount_percent), 10);
    await item(o.id, { p_quantity: 2 });
    const afterItem = await state(o.id);
    assert.equal(Number(afterItem.discount_percent), 10);
    assert.equal(Number(afterItem.discount_amount), 4);
    assert.equal(Number(afterItem.total), 36);
    return {
      after_patch: {
        discount_amount: afterPatch.discount_amount,
        discount_percent: afterPatch.discount_percent,
      },
      after_quantity_2: {
        subtotal: afterItem.subtotal,
        discount_amount: afterItem.discount_amount,
        total: afterItem.total,
      },
    };
  },
);

// 7. E3.1: UI rebuild callback passes expectedVersion and rejects stale rebuild
await check(
  "fixed",
  "UI rebuild callback passes expectedVersion and rejects stale rebuild",
  async () => {
    const source = fs.readFileSync(root + "/src/components/staff/ModificationsPanel.tsx", "utf8");
    const sf = ts.createSourceFile(
      "ModificationsPanel.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let cb;
    function visit(n) {
      if (
        ts.isJsxAttribute(n) &&
        n.name.getText(sf) === "onReplaceItems" &&
        n.initializer?.expression
      ) {
        cb = n.initializer.expression;
      }
      ts.forEachChild(n, visit);
    }
    visit(sf);
    assert.ok(cb);
    const o = await create();
    await item(o.id, { p_quantity: 3 });
    let sent;
    const callback = vm.runInNewContext(
      "(" +
        ts
          .transpileModule("const cb=" + cb.getText(sf) + ";", {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          })
          .outputText.replace(/^const cb\s*=\s*/, "")
          .replace(/;\s*$/, "") +
        ")",
      {
        selected: { id: o.id, version: 2 },
        rebuild: {
          mutate: (v) => {
            sent = v;
          },
        },
      },
    );
    callback([{ name: "Synthetic cake", unitPrice: 20, quantity: 1 }]);
    assert.equal(Object.hasOwn(sent, "expectedVersion"), true);
    assert.equal(sent.expectedVersion, 2);
    const s = await state(o.id);
    assert.equal(s.order_items[0].quantity, 3);
    const rejection = await reject(
      () => app.replaceSalesOrderItems.run({ ...sent, expectedVersion: 1 }, ctx(ids.sales)),
      /OCC_VERSION_MISMATCH|تعارض/,
    );
    return {
      ui_callback: cb.getText(sf),
      sent_to_rebuild: sent,
      rejection: rejection.message,
      current_quantity: s.order_items[0].quantity,
    };
  },
);

// 8. Actual item validator and handler preserve version and reject stale item write
await check(
  "fixed",
  "Actual item validator and handler preserve version and reject stale item write",
  async () => {
    const o = await create();
    const s = await state(o.id);
    const i = s.order_items[0];
    await item(o.id, { p_quantity: 3 });
    const e = await reject(
      () =>
        app.updateSalesOrderItemPrice.run(
          { orderId: o.id, itemId: i.id, expectedVersion: 1, quantity: 1, newUnitPrice: 20 },
          ctx(ids.sales),
        ),
      /OCC_VERSION_MISMATCH/,
    );
    return { rejection: e, quantity: (await state(o.id)).order_items[0].quantity };
  },
);

// 9. Actual endpoint clears item notes via empty string
await check("fixed", "Actual endpoint clears item notes via empty string", async () => {
  const o = await create({}, [{ ...line, notes: "Must be cleared" }]);
  const s = await state(o.id);
  await app.updateSalesOrderItemPrice.run(
    { orderId: o.id, itemId: s.order_items[0].id, expectedVersion: 1, notes: "" },
    ctx(ids.sales),
  );
  const saved = (await state(o.id)).order_items[0].notes;
  assert.equal(saved, null);
  return { saved_notes: saved };
});

// 10. E3.2: One real size selection produces one mutation updating price and options together
await check(
  "fixed",
  "One real size selection produces one atomic mutation updating price and options together",
  async () => {
    const source = fs.readFileSync(root + "/src/components/staff/ModificationsPanel.tsx", "utf8");
    const sf = ts.createSourceFile(
      "ModificationsPanel.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const defs = {};
    let change;
    function visit(n) {
      if (
        ts.isVariableDeclaration(n) &&
        ["withLabel", "commitOptions", "handleItemPatch"].includes(n.name.getText(sf))
      ) {
        defs[n.name.getText(sf)] = n.initializer.getText(sf);
      }
      if (
        ts.isJsxAttribute(n) &&
        n.name.getText(sf) === "onChange" &&
        n.initializer?.expression?.getText(sf).includes("const size = product?.sizes.find")
      ) {
        change = n.initializer.expression.getText(sf);
      }
      ts.forEachChild(n, visit);
    }
    visit(sf);
    assert.ok(change);
    const evaluate = (expression, bindings) => {
      const js = ts.transpileModule("const result=" + expression + ";globalThis.result=result;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText;
      const c = { ...bindings };
      vm.runInNewContext(js, c);
      return c.result;
    };
    const o = await create({}, [{ ...line, options_ar: ["الحجم: Small"] }]);
    const s = await state(o.id);
    const i = s.order_items[0];
    const sent = [];
    const wrap = evaluate(defs.handleItemPatch, {
      pendingSelfMutationRef: { current: false },
      initialVersionRef: { current: 1 },
      onItemPatch: (p) => sent.push({ orderId: o.id, ...p }),
    });
    const commit = evaluate(defs.commitOptions, {
      item: i,
      setOptions: () => {},
      onItemPatch: wrap,
    });
    const onChange = evaluate(change, {
      item: i,
      product: { sizes: [{ label: "Large", price: 30 }] },
      options: i.options_ar,
      setSizeLabel: () => {},
      setOptions: () => {},
      onItemPatch: wrap,
      commitOptions: commit,
      withLabel: evaluate(defs.withLabel, {}),
    });
    onChange({ target: { value: "Large" } });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].expectedVersion, 1);
    assert.equal(sent[0].newUnitPrice, 30);
    assert.equal(sent[0].options[0], "الحجم: Large");
    await app.updateSalesOrderItemPrice.run(sent[0], ctx(ids.sales));
    const saved = (await state(o.id)).order_items[0];
    assert.equal(Number(saved.unit_price), 30);
    assert.equal(saved.options_ar[0], "الحجم: Large");
    return {
      emitted_requests: sent,
      saved_price: saved.unit_price,
      saved_options: saved.options_ar,
    };
  },
);

// 11. E4: Actual item endpoint records before/after option and note details in persisted modification history
await check(
  "fixed",
  "Actual item endpoint records before/after option and note details in persisted modification history",
  async () => {
    const o = await create({}, [
      { ...line, options_ar: ["Original filling"], notes: "Original item note" },
    ]);
    const s = await state(o.id);
    await app.updateSalesOrderItemPrice.run(
      {
        orderId: o.id,
        itemId: s.order_items[0].id,
        expectedVersion: 1,
        name: "Changed cake",
        options: ["New filling"],
        notes: "Changed item note",
      },
      ctx(ids.sales),
    );
    const saved = await state(o.id);
    assert.equal(saved.order_items[0].notes, "Changed item note");
    const kitchen = await actor("authenticated", ids.kitchen, () =>
      db.query("SELECT modifications FROM public.get_kitchen_orders() WHERE id = $1", [o.id]),
    );
    assert.equal(JSON.stringify(saved.modifications).includes("Original filling"), true);
    assert.equal(JSON.stringify(saved.modifications).includes("New filling"), true);
    assert.equal(JSON.stringify(saved.modifications).includes("Original item note"), true);
    assert.equal(JSON.stringify(saved.modifications).includes("Changed item note"), true);
    return {
      saved_options: saved.order_items[0].options_ar,
      stored_modifications: saved.modifications,
      kitchen_modifications: kitchen.rows[0].modifications,
    };
  },
);

// 12. E6.1: Actual social rebuild endpoint succeeds for social role
await check("fixed", "Actual social rebuild endpoint succeeds for social role", async () => {
  const o = await create({}, [line], ids.social);
  const res = await app.replaceSalesOrderItems.run(
    {
      orderId: o.id,
      expectedVersion: 1,
      lines: [{ name: "Synthetic cake", unitPrice: 20, quantity: 2 }],
    },
    ctx(ids.social),
  );
  assert.equal(res.items[0].quantity, 2);
  return { succeeded: true, quantity: res.items[0].quantity };
});

// 13. E6.2: Rebuild allows normal price edit when permission row is absent
const freeProduct = (
  await db.query(
    "INSERT INTO public.products(name_ar, name_en, slug, category, price) VALUES('Normal cake', 'Normal cake', 'normal-v6-cake', 'Cake', 20) RETURNING id",
  )
).rows[0].id;

await check("fixed", "Rebuild allows normal price edit when permission row is absent", async () => {
  const o = await create({}, [{ ...line, product_id: freeProduct }]);
  const allowed = await loadApp("src/lib/permissions.functions.ts").canEditProductPrice(
    ctx(ids.sales),
    freeProduct,
  );
  assert.equal(allowed, true);
  const res = await app.replaceSalesOrderItems.run(
    {
      orderId: o.id,
      expectedVersion: 1,
      lines: [{ name: "Normal cake", productId: freeProduct, unitPrice: 25, quantity: 1 }],
    },
    ctx(ids.sales),
  );
  assert.equal(Number(res.items[0].unit_price), 25);
  return { application_permission: allowed, unit_price: res.items[0].unit_price };
});

// 14. E6.3: Rebuild with existing authorized discount succeeds for staff member without discount permission
await check(
  "fixed",
  "Rebuild with existing authorized discount succeeds for staff member without new discount permission",
  async () => {
    const o = await create();
    await actor("authenticated", ids.admin, () =>
      db.query("SELECT public.apply_order_discount_atomic($1, 4, 20, 1)", [o.id]),
    );
    await db.query(
      "UPDATE public.staff_permissions SET allow_custom_discount = false, max_discount_percent = 0 WHERE user_id = $1",
      [ids.sales],
    );
    const res = await app.replaceSalesOrderItems.run(
      {
        orderId: o.id,
        expectedVersion: 2,
        lines: [{ name: "Synthetic cake", unitPrice: 20, quantity: 1, notes: "Only note changes" }],
      },
      ctx(ids.sales),
    );
    assert.equal(Number(res.discount_amount), 4);
    return { succeeded: true, discount_amount: res.discount_amount, total: res.total };
  },
);

// 15. E2: Rebuild recalculates discount_amount consistently from discount_percent, and editing notes does not change total
await check(
  "fixed",
  "Rebuild recalculates discount_amount consistently from discount_percent, and editing notes does not change total",
  async () => {
    const o = await create();
    await actor("authenticated", ids.admin, () =>
      db.query("SELECT public.apply_order_discount_atomic($1, 2, 10, 1)", [o.id]),
    );
    await db.query(
      "UPDATE public.staff_permissions SET allow_custom_discount = true, max_discount_percent = 10 WHERE user_id = $1",
      [ids.sales],
    );
    await app.replaceSalesOrderItems.run(
      {
        orderId: o.id,
        expectedVersion: 2,
        lines: [{ name: "Synthetic cake", unitPrice: 40, quantity: 1 }],
      },
      ctx(ids.sales),
    );
    const s = await state(o.id);
    assert.equal(Number(s.discount_percent), 10);
    assert.equal(Number(s.discount_amount), 4);
    assert.equal(Number(s.total), 36);
    await app.updateSalesOrderItemPrice.run(
      { orderId: o.id, itemId: s.order_items[0].id, expectedVersion: 3, notes: "Note only" },
      ctx(ids.sales),
    );
    const next = await state(o.id);
    assert.equal(Number(next.discount_amount), 4);
    assert.equal(Number(next.total), 36);
    return {
      after_rebuild: {
        subtotal: s.subtotal,
        discount_amount: s.discount_amount,
        discount_percent: s.discount_percent,
        total: s.total,
      },
      after_note_only: { discount_amount: next.discount_amount, total: next.total },
    };
  },
);

// 16. E5: Kitchen item RPC masks phones and prices in notes and options
await check("fixed", "Kitchen item RPC masks phones and prices in notes and options", async () => {
  const o = await create({}, [
    {
      ...line,
      name_ar: "Cake",
      notes: "Call 079 123 4567",
      options_ar: ["قيمة الطلب 40 د.أ", "هاتف المستلم: 0791234567"],
    },
  ]);
  const r = await actor("authenticated", ids.kitchen, () =>
    db.query("SELECT * FROM public.get_kitchen_order_items(ARRAY[$1::uuid])", [o.id]),
  );
  assert.equal(r.rows[0].notes.includes("079 123 4567"), false);
  assert.equal(r.rows[0].notes.includes("Call ***"), true);
  assert.equal(
    r.rows[0].options_ar.some((opt) => opt.includes("40 د.أ")),
    false,
  );
  assert.equal(
    r.rows[0].options_ar.some((opt) => opt.includes("0791234567")),
    false,
  );
  return r.rows[0];
});

// 17. E5: Kitchen main RPC masks phones in inscription and card_note
await check("fixed", "Kitchen main RPC masks phones in inscription and card_note", async () => {
  const o = await create({ inscription: "Call 079 123 4567", card_note: "هاتف: 0791234567" });
  const r = await actor("authenticated", ids.kitchen, () =>
    db.query("SELECT inscription, card_note FROM public.get_kitchen_orders() WHERE id = $1", [
      o.id,
    ]),
  );
  assert.equal(r.rows[0].inscription.includes("079 123 4567"), false);
  assert.equal(r.rows[0].card_note.includes("0791234567"), false);
  return r.rows[0];
});

// 18. E5: Actual kitchen feed filters out monetary text in free-text options
await check(
  "fixed",
  "Actual kitchen feed filters out monetary text in free-text options",
  async () => {
    const o = await create({}, [
      { ...line, notes: "Call 079 123 4567", options_ar: ["قيمة الطلب 40 د.أ"] },
    ]);
    const feed = await loadApp("src/lib/kds.functions.ts").getKitchenOrders.run(
      undefined,
      ctx(ids.kitchen),
    );
    const row = feed.find((x) => x.id === o.id);
    assert.ok(row);
    assert.equal(row.items[0].options_ar.includes("قيمة الطلب 40 د.أ"), false);
    assert.equal(row.items[0].notes.includes("079"), false);
    return { options_ar: row.items[0].options_ar, masked_item_notes: row.items[0].notes };
  },
);

// 19. E3.3: Kitchen status writer advances version so stale sales status patch is rejected
await check(
  "fixed",
  "Kitchen status writer advances version so stale sales status patch is rejected",
  async () => {
    const o = await create();
    await actor("authenticated", ids.kitchen, () =>
      db.query("SELECT public.update_kitchen_order_status($1, 'baking')", [o.id]),
    );
    const before = await state(o.id);
    assert.equal(before.version, 2);
    const rejection = await reject(
      () => patch(o.id, { status: "confirmed" }, 1),
      /تعارض في التعديل|Optimistic locking conflict/,
    );
    const after = await state(o.id);
    assert.equal(after.status, "baking");
    return {
      after_kitchen: { version: before.version, status: before.status },
      rejection: rejection.message,
    };
  },
);

// 20. D4: Actual public customer-edit handler returns only safe fields and forbids authenticated RPC execution
await check(
  "fixed",
  "Actual public customer-edit handler returns only safe fields and forbids authenticated RPC execution",
  async () => {
    const o = await create({
      staff_notes: "PRIVATE STAFF NOTE",
      receipt_image_url: "https://synthetic.invalid/private-receipt",
    });
    const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    await db.query(
      "INSERT INTO public.order_edit_tokens(order_id, token_hash, expires_at) VALUES($1, $2, now() + interval '1 hour')",
      [o.id, createHash("sha256").update(token).digest("hex")],
    );
    const r = await loadApp("src/lib/authorization.functions.ts").submitOrderEdit.run(
      { token, notes: "Customer updated" },
      {},
    );
    assert.equal(r.ok, true);
    assert.equal(r.order.staff_notes, undefined);
    assert.equal(r.order.receipt_image_url, undefined);
    assert.equal(r.order.notes, "Customer updated");
    const permissions = (
      await db.query(
        "SELECT has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated, has_function_privilege('anon', oid, 'EXECUTE') AS anon, has_function_privilege('service_role', oid, 'EXECUTE') AS service_role FROM pg_proc WHERE proname = 'submit_customer_order_edit_atomic'",
      )
    ).rows[0];
    assert.equal(permissions.authenticated, false);
    assert.equal(permissions.anon, false);
    assert.equal(permissions.service_role, true);
    return { returned_fields: Object.keys(r.order), permissions };
  },
);

// 21. E6.4: Order items trigger permits deleting catalog product via ON DELETE SET NULL cascade
await check(
  "fixed",
  "Order items trigger permits deleting catalog product via ON DELETE SET NULL cascade",
  async () => {
    await create({}, [{ ...line, product_id: freeProduct }]);
    const r = await actor("authenticated", ids.sales, () =>
      db.query("DELETE FROM public.products WHERE id = $1 RETURNING id", [freeProduct]),
    );
    assert.equal(r.rows.length, 1);
    return { deleted_product_id: r.rows[0].id };
  },
);

// 22. E1.3: Rebuild rejects empty lines and prevents destroying order items
await check(
  "fixed",
  "Rebuild rejects empty lines and prevents destroying order items",
  async () => {
    const o = await create();
    const e = await reject(
      () =>
        actor("authenticated", ids.sales, () =>
          db.query(
            "SELECT public.rebuild_sales_order_atomic($1, $2::jsonb, 0, 0, 0, 0, $3, $4::jsonb, 1)",
            [o.id, "[]", ids.sales, "[]"],
          ),
        ),
      /لا يمكن إعادة بناء الطلب بدون أصناف/,
    );
    const s = await state(o.id);
    assert.ok(s.order_items.length > 0);
    return { rejected: true, error: e.message, remaining_items: s.order_items.length };
  },
);

// 23. E1.3: Direct table INSERT on orders is prohibited by guard trigger
await check("fixed", "Direct table INSERT on orders is prohibited by guard trigger", async () => {
  const e = await reject(
    () =>
      actor("authenticated", ids.sales, () =>
        db.query(
          "INSERT INTO public.orders(customer_name, customer_phone, subtotal, total, original_items, modifications, discount_amount) VALUES('Synthetic forged', '0790000000', 200, 1, '[{\"arbitrary\":true}]', '[{\"field\":\"forged-history\"}]', 199) RETURNING id, subtotal, total, original_items, modifications",
        ),
      ),
    /Direct INSERT on orders is prohibited/,
  );
  return { rejected: true, error: e.message };
});

// 24. Authorized admin deletion still removes order and cascades through guarded items
await check(
  "fixed",
  "Authorized admin deletion still removes order and cascades through guarded items",
  async () => {
    const o = await create();
    await actor("authenticated", ids.admin, () =>
      db.query("SELECT public.delete_sales_order_atomic($1)", [o.id]),
    );
    assert.equal(await state(o.id), undefined);
    return { deleted: true };
  },
);

await db.close();

const totalChecks = observations.length;
const verifiedChecks = observations.filter((o) => o.verified).length;
if (verifiedChecks === totalChecks && totalChecks === 24) {
  console.log(
    `All ${totalChecks} checks completed successfully! (Verified: ${verifiedChecks}/${totalChecks})`,
  );
} else {
  console.error(`❌ Review failed: only ${verifiedChecks} of ${totalChecks} checks verified!`);
  process.exitCode = 1;
}
