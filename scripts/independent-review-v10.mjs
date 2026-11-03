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
const output = process.env.DELISH_REVIEW_OUTPUT || path.resolve("results_v10.json");
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
let afterRpcCommit = null;
const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 GRANT ALL ON storage.buckets,storage.objects TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
`);
await db.exec(schema);
for (const [role, id] of Object.entries(ids)) {
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
    id,
    role + "@synthetic.invalid",
  ]);
  if (role !== "visitor")
    await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,$2::public.app_role)", [
      id,
      role,
    ]);
}
await db.query(
  "INSERT INTO public.staff_permissions(user_id,allow_price_override,allow_custom_discount,max_discount_percent) VALUES($1,false,false,0)",
  [ids.sales],
);
async function actor(role, uid, fn) {
  await db.exec("SET ROLE " + role);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid || ""]);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
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
    requested_date: "2026-11-01",
    requested_time: "14:00:00",
    client_request_id: randomUUID(),
    ...extra,
  };
  return (
    await actor("authenticated", uid, () =>
      db.query("SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r", [
        JSON.stringify(order),
        JSON.stringify(items),
      ]),
    )
  ).rows[0].r;
}
async function state(id) {
  return (
    await db.query(
      "SELECT o.*, (SELECT jsonb_agg(i) FROM public.order_items i WHERE i.order_id=o.id) AS order_items FROM public.orders o WHERE id=$1",
      [id],
    )
  ).rows[0];
}
async function patch(id, p, version = 1) {
  return (
    await actor("authenticated", ids.sales, () =>
      db.query("SELECT public.patch_sales_order_atomic($1,$2::jsonb,$3::jsonb,$4,$5) AS r", [
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
  const s = await state(id),
    i = s.order_items[0];
  const a = {
    p_order_id: id,
    p_item_id: i.id,
    p_unit_price: Number(i.unit_price),
    p_expected_version: s.version,
    ...p,
  };
  const keys = Object.keys(a),
    values = keys.map((k) => a[k]);
  return (
    await actor("authenticated", ids.sales, () =>
      db.query(
        "SELECT public.update_order_item_atomic(" +
          keys.map((k, i) => k + "=>$" + (i + 1)).join(",") +
          ") AS r",
        values,
      ),
    )
  ).rows[0].r;
}

// SQL-backed adapter: every requested table/RPC operation executes against the delivered database.
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw Error("Invalid SQL identifier");
  return '"' + s + '"';
};
function postgrestValue(value, key = "") {
  if (value instanceof Date)
    return ["requested_date", "event_date"].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  if (Array.isArray(value)) return value.map((x) => postgrestValue(x, key));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, postgrestValue(v, k)]));
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
    const filters = [],
      orders = [];
    let single = false,
      maybe = false,
      selected = "*",
      offset = 0,
      limit = null,
      mutation = null,
      payload = null;
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
                  ident(k) +
                  "=>" +
                  add(json && v !== null ? JSON.stringify(v) : v) +
                  (json ? "::jsonb" : "")
                );
              });
            from = "public." + ident(rpc.name) + "(" + args.join(",") + ")";
          } else from = "public." + ident(table);
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
          } else if (mutation === "UPDATE")
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
          else if (mutation === "DELETE") statement = "DELETE FROM " + from;
          else if (rpc && !["get_kitchen_orders", "get_kitchen_order_items"].includes(rpc.name))
            statement = "SELECT " + from + " AS r";
          else statement = "SELECT * FROM " + from;
          if (filters.length)
            statement +=
              " WHERE " +
              filters
                .map(([k, op, v]) =>
                  op === "IN"
                    ? ident(k) + " IN (" + v.map(add).join(",") + ")"
                    : ident(k) + op + add(v),
                )
                .join(" AND ");
          if (!mutation) {
            if (orders.length) statement += " ORDER BY " + orders.join(",");
            if (limit !== null) statement += " LIMIT " + Number(limit);
            if (offset) statement += " OFFSET " + Number(offset);
          } else statement += " RETURNING *";
          const raw = await db.query(statement, vals);
          const r = { rows: raw.rows.map((row) => postgrestValue(row)) };
          if (rpc && !["get_kitchen_orders", "get_kitchen_order_items"].includes(rpc.name))
            return r.rows[0]?.r ?? null;
          if (table === "orders" && selected.includes("order_items("))
            for (const row of r.rows)
              row.order_items = (
                await db.query("SELECT * FROM public.order_items WHERE order_id=$1", [row.id])
              ).rows;
          if (single) {
            if (r.rows.length !== 1 && !maybe) throw Error("Expected one row");
            return r.rows[0] || null;
          }
          return r.rows;
        })
          .then(async (result) => {
            if (rpc && !result.error && afterRpcCommit)
              await afterRpcCommit({
                uid,
                role,
                name: rpc.name,
                args: rpc.args,
                data: result.data,
              });
            return result;
          })
          .then(ok, bad);
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

// Run the actual modules, replacing only framework registration/environment plumbing.
// Role, price permission, discount authorization, validators, handlers and SQL are original code.
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
    if (spec === "@tanstack/react-start")
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
  requested_date: "2026-11-01",
  requested_time: "14:00",
  client_request_id: randomUUID(),
  items: [{ name_ar: "Synthetic cake", quantity: 1, unit_price: 20 }],
});

const evaluate = (expression, bindings = {}) => {
  const code = ts.transpileModule("const result=" + expression + ";globalThis.result=result;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const c = { ...bindings };
  vm.runInNewContext(code, c);
  return c.result;
};
function sourceParts(file) {
  const text = fs.readFileSync(root + "/" + file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const variables = new Map(),
    attributes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer)
      variables.set(n.name.getText(sf), n.initializer.getText(sf));
    if (ts.isJsxAttribute(n) && n.initializer?.expression)
      attributes.push({
        name: n.name.getText(sf),
        expression: n.initializer.expression.getText(sf),
      });
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return { text, variables, attributes };
}
const mod = sourceParts("src/components/staff/ModificationsPanel.tsx");
const builder = sourceParts("src/components/staff/WebsiteRebuildPanel.tsx");

const sf = ts.createSourceFile(
  "ModificationsPanel.tsx",
  mod.text,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let versionEffect;
function findEffect(n) {
  if (
    ts.isCallExpression(n) &&
    n.expression.getText(sf) === "useEffect" &&
    n.arguments[0]?.getText(sf).includes("if (pendingSelfMutationRef.current)")
  )
    versionEffect = n.arguments[0].getText(sf);
  ts.forEachChild(n, findEffect);
}
findEffect(sf);
assert.ok(versionEffect);
const toast = { success: () => {}, error: () => {} };
const currency = loadApp("src/lib/currency.ts");
const conflict = (refs, order) =>
  evaluate(mod.variables.get("hasConcurrentConflict"), {
    pendingSelfMutationRef: refs.pending,
    initialVersionRef: refs.version,
    order,
  });
function refresh(refs, order) {
  evaluate(versionEffect, {
    pendingSelfMutationRef: refs.pending,
    initialVersionRef: refs.version,
    order,
  })();
}
async function finishFromInitial(initial, latest, refs) {
  const parent = evaluate(mod.variables.get("handleFinishEdit"), {
    selectedId: initial.id,
    selected: latest,
    save: { mutateAsync: (input) => app.updateSalesOrder.run(input, ctx(ids.sales)) },
    toast,
    onCloseEdit: undefined,
  });
  let payload;
  const reqDate =
    initial.requested_date instanceof Date
      ? initial.requested_date.toISOString().slice(0, 10)
      : String(initial.requested_date).slice(0, 10);
  const fn = evaluate(mod.variables.get("handleFinish"), {
    setIsFinishing: () => {},
    onFinishEdit: async (p) => {
      payload = p;
      return parent(p);
    },
    order: latest,
    orderName: initial.order_name || "",
    customerName: initial.customer_name,
    customerPhone: initial.customer_phone,
    senderPhone: initial.sender_phone || "",
    recipientPhone: initial.recipient_phone || "",
    initialVersionRef: refs.version,
    date: reqDate,
    time: initial.requested_time.slice(0, 5),
    address: initial.address || "",
    inscription: initial.inscription || "",
    cardNote: initial.card_note || "",
    notes: initial.notes || "",
    staffNotes: initial.staff_notes || "",
  });
  await fn();
  return { payload, saved: await state(initial.id) };
}

await check("fixed", "Current standalone schema reapplies successfully", async () => {
  await db.exec(schema);
  return { reapplied: true };
});
await check("fixed", "Hidden catalog product remains locked for social employee", async () => {
  const p = (
    await db.query(
      "INSERT INTO public.products(name_ar,name_en,slug,category,price) VALUES('Locked cake','Locked cake','locked-v10','Cake',20) RETURNING id",
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO public.sales_product_permissions(user_id,product_id,can_edit_price) VALUES($1,$2,false)",
    [ids.social, p],
  );
  const o = await create({}, [{ ...line, product_id: p }]),
    s = await state(o.id),
    i = s.order_items[0];
  await db.query("UPDATE public.products SET is_available=false WHERE id=$1", [p]);
  const unlink = await reject(
    () =>
      actor("authenticated", ids.social, () =>
        db.query("UPDATE public.order_items SET product_id=NULL WHERE id=$1", [i.id]),
      ),
    /Direct mutation/,
  );
  const price = await reject(
    () =>
      app.updateSalesOrderItemPrice.run(
        { orderId: o.id, itemId: i.id, expectedVersion: 1, newUnitPrice: 1 },
        ctx(ids.social),
      ),
    /لا تملك صلاحية تعديل سعر هذا المنتج/,
  );
  assert.equal(Number((await state(o.id)).total), 20);
  return { unlink, price, total: 20 };
});

async function commitRace(kind) {
  const initial = await app.createSalesOrder.run(baseInput(), ctx(ids.sales)),
    refs = { pending: { current: false }, version: { current: 1 } };
  let inFlight, atomicVersion;
  const target = {
    item: "update_order_item_atomic",
    discount: "apply_order_discount_atomic",
    rebuild: "rebuild_sales_order_atomic",
    patch: "patch_sales_order_atomic",
    payment: "record_order_payment_atomic",
  }[kind];
  afterRpcCommit = async (info) => {
    if (info.uid !== ids.sales || info.name !== target) return;
    afterRpcCommit = null;
    atomicVersion = info.data.version;
    assert.equal(atomicVersion, 2);
    await app.updateSalesOrder.run(
      { orderId: initial.id, expected_version: 2, customer_name: "COLLEAGUE AFTER OWN COMMIT" },
      ctx(ids.admin),
    );
  };
  try {
    if (kind === "item") {
      const wrap = evaluate(mod.variables.get("handleItemPatch"), {
        pendingSelfMutationRef: refs.pending,
        initialVersionRef: refs.version,
        onItemPatch: (p) => {
          inFlight = app.updateSalesOrderItemPrice.run(
            { orderId: initial.id, ...p },
            ctx(ids.sales),
          );
          return inFlight;
        },
      });
      wrap({ itemId: initial.items[0].id, quantity: 2 });
    } else if (kind === "discount") {
      await db.query(
        "UPDATE public.staff_permissions SET allow_custom_discount=true,max_discount_percent=10 WHERE user_id=$1",
        [ids.sales],
      );
      const wrap = evaluate(mod.variables.get("handleDiscount"), {
        pendingSelfMutationRef: refs.pending,
        initialVersionRef: refs.version,
        onDiscount: (percent, reason, expectedVersion) => {
          inFlight = loadApp("src/lib/authorization.functions.ts").applyOrderDiscount.run(
            { orderId: initial.id, percent, reason, expectedVersion },
            ctx(ids.sales),
          );
          return inFlight;
        },
      });
      wrap(10, "Synthetic discount");
    } else if (kind === "rebuild") {
      const wrap = evaluate(mod.variables.get("handleReplaceItems"), {
        pendingSelfMutationRef: refs.pending,
        initialVersionRef: refs.version,
        onReplaceItems: (lines, expectedVersion) => {
          inFlight = app.replaceSalesOrderItems.run(
            { orderId: initial.id, lines, expectedVersion },
            ctx(ids.sales),
          );
          return inFlight;
        },
      });
      wrap([{ name: "Synthetic cake", unitPrice: 20, quantity: 2 }]);
    } else if (kind === "patch") {
      const parent = evaluate(mod.attributes.find((a) => a.name === "onPatch").expression, {
        selected: initial,
        save: {
          mutateAsync: (p) => {
            inFlight = app.updateSalesOrder.run(p, ctx(ids.sales));
            return inFlight;
          },
        },
      });
      const wrap = evaluate(mod.variables.get("handlePatch"), {
        pendingSelfMutationRef: refs.pending,
        initialVersionRef: refs.version,
        onPatchProp: parent,
      });
      wrap({ method: "delivery" });
    } else {
      const wrap = evaluate(mod.variables.get("handleQuickAddPayment"), {
        order: initial,
        isProcessingQuickPayment: false,
        setIsProcessingQuickPayment: () => {},
        pendingSelfMutationRef: refs.pending,
        initialVersionRef: refs.version,
        quickPaymentIdempotencyKeyRef: { current: randomUUID() },
        recordPaymentServer: ({ data }) => {
          inFlight = app.recordOrderPayment.run(data, ctx(ids.sales));
          return inFlight;
        },
        toast,
        jd: currency.jd,
        crypto: webcrypto,
      });
      await wrap(5, "remainder");
    }
    const response = await inFlight;
    assert.equal(response.version, 2);
    assert.equal(refs.version.current, 2);
    const latest = await state(initial.id);
    assert.equal(latest.version, 3);
    assert.equal(latest.customer_name, "COLLEAGUE AFTER OWN COMMIT");
    refresh(refs, latest);
    assert.equal(conflict(refs, latest), true);
    const rejection = await reject(() => finishFromInitial(initial, latest, refs), /تعارض/);
    const saved = await state(initial.id);
    assert.equal(saved.customer_name, "COLLEAGUE AFTER OWN COMMIT");
    assert.equal(saved.version, 3);
    return {
      kind,
      atomic_version: atomicVersion,
      returned_version: response.version,
      ui_reference: refs.version.current,
      colleague_version: latest.version,
      conflict: true,
      finish_rejection: rejection,
      colleague_name_preserved: saved.customer_name,
    };
  } finally {
    afterRpcCommit = null;
  }
}
await check(
  "fixed",
  "Atomic version preserves colleague edits across item, discount, rebuild, general patch and payment paths",
  async () => {
    const results = [];
    for (const kind of ["item", "discount", "rebuild", "patch", "payment"])
      results.push(await commitRace(kind));
    return results;
  },
);
await check(
  "fixed",
  "Quick payment advances editor version and allows subsequent own header save",
  async () => {
    const initial = await app.createSalesOrder.run(baseInput(), ctx(ids.sales)),
      refs = { pending: { current: false }, version: { current: 1 } };
    const quick = evaluate(mod.variables.get("handleQuickAddPayment"), {
      order: initial,
      isProcessingQuickPayment: false,
      setIsProcessingQuickPayment: () => {},
      pendingSelfMutationRef: refs.pending,
      initialVersionRef: refs.version,
      quickPaymentIdempotencyKeyRef: { current: randomUUID() },
      recordPaymentServer: ({ data }) => app.recordOrderPayment.run(data, ctx(ids.sales)),
      toast,
      jd: currency.jd,
      crypto: webcrypto,
    });
    await quick(5, "remainder");
    const latest = await state(initial.id);
    assert.equal(refs.version.current, 2);
    refresh(refs, latest);
    assert.equal(conflict(refs, latest), false);
    const final = await finishFromInitial(initial, latest, refs);
    assert.equal(final.saved.version, 3);
    const ledger = (
      await db.query(
        "SELECT count(*)::int AS n,sum(amount)::numeric AS amount FROM public.order_payments WHERE order_id=$1",
        [initial.id],
      )
    ).rows[0];
    assert.equal(ledger.n, 1);
    return {
      payment_saved: latest.deposit_paid,
      ledger_count: ledger.n,
      ui_reference: refs.version.current,
      final_saved_version: final.saved.version,
    };
  },
);
await check(
  "fixed",
  "Fulfillment button uses handlePatch and permits next header save without false conflict",
  async () => {
    const initial = await app.createSalesOrder.run(baseInput(), ctx(ids.sales)),
      refs = { pending: { current: false }, version: { current: 1 } };
    let inFlight;
    const parent = evaluate(mod.attributes.find((a) => a.name === "onPatch").expression, {
      selected: initial,
      save: {
        mutateAsync: (p) => {
          inFlight = app.updateSalesOrder.run(p, ctx(ids.sales));
          return inFlight;
        },
      },
    });
    const wrap = evaluate(mod.variables.get("handlePatch"), {
      pendingSelfMutationRef: refs.pending,
      initialVersionRef: refs.version,
      onPatchProp: parent,
    });
    const button = mod.attributes.find(
      (a) => a.name === "onClick" && a.expression.includes('onPatch({ method: "delivery" })'),
    );
    await evaluate(button.expression, { onPatch: wrap })();
    await inFlight;
    const latest = await state(initial.id);
    assert.equal(latest.method, "delivery");
    assert.equal(refs.version.current, 2);
    refresh(refs, latest);
    assert.equal(conflict(refs, latest), false);
    const final = await finishFromInitial(initial, latest, refs);
    assert.equal(final.saved.version, 3);
    return {
      saved_method: latest.method,
      reference_after_partial: refs.version.current,
      final_version: final.saved.version,
    };
  },
);

await check(
  "fixed",
  "Adding a new item from TouchItemEditorSheet uses handleReplaceItems and permits subsequent header save without false conflict",
  async () => {
    const initial = await app.createSalesOrder.run(baseInput(), ctx(ids.sales)),
      refs = { pending: { current: false }, version: { current: 1 } };
    let inFlight, sent;
    const parent = evaluate(mod.attributes.find((a) => a.name === "onReplaceItems").expression, {
      selected: initial,
      rebuild: {
        mutateAsync: (p) => {
          sent = p;
          inFlight = app.replaceSalesOrderItems.run(p, ctx(ids.sales));
          return inFlight;
        },
      },
    });
    const handleReplaceItems = evaluate(mod.variables.get("handleReplaceItems"), {
      pendingSelfMutationRef: refs.pending,
      initialVersionRef: refs.version,
      onReplaceItems: parent,
    });
    const add = mod.attributes.find(
      (a) => a.name === "onSave" && a.expression.includes("const nextLines"),
    );
    assert.ok(add);
    evaluate(add.expression, {
      activeSheetItem: null,
      order: initial,
      handleItemPatch: () => {
        throw Error("Unexpected existing-item branch");
      },
      handleReplaceItems,
      onReplaceItems: handleReplaceItems,
    })({
      productId: null,
      name: "New synthetic item",
      quantity: 1,
      unitPrice: 5,
      options: [],
      notes: null,
    });
    await inFlight;
    const latest = await state(initial.id);
    assert.equal(latest.order_items.length, 2);
    assert.equal(Number(latest.total), 25);
    assert.equal(latest.version, 2);
    assert.equal(refs.version.current, 2);
    refresh(refs, latest);
    assert.equal(conflict(refs, latest), false);
    const final = await finishFromInitial(initial, latest, refs);
    assert.equal(final.saved.version, 3);
    return {
      add_succeeded: true,
      items: latest.order_items.length,
      total: latest.total,
      request_expected_version: sent.expectedVersion,
      stored_version: latest.version,
      ui_reference: refs.version.current,
      false_conflict: false,
      final_saved_version: final.saved.version,
    };
  },
);
await check(
  "fixed",
  "Main save updates active editor reference and permits consecutive saves without false conflict",
  async () => {
    const initial = await app.createSalesOrder.run(baseInput(), ctx(ids.sales)),
      refs = { pending: { current: false }, version: { current: 1 } };
    const first = await finishFromInitial(initial, initial, refs);
    assert.equal(first.saved.version, 2);
    assert.equal(refs.version.current, 2);
    refresh(refs, first.saved);
    assert.equal(conflict(refs, first.saved), false);
    const second = await finishFromInitial(first.saved, first.saved, refs);
    assert.equal(second.saved.version, 3);
    assert.equal(refs.version.current, 3);
    return {
      first_save_succeeded: true,
      first_version: first.saved.version,
      second_save_succeeded: true,
      second_version: second.saved.version,
      ui_reference: refs.version.current,
      false_conflict: false,
    };
  },
);

if (process.env.DELISH_PREVIOUS_SCHEMA)
  await check(
    "fixed",
    "Upgrade from preceding production schema preserves existing orders and changes rebuild return type cleanly",
    async () => {
      const prior = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
      const code = fs.readFileSync(new URL(import.meta.url), "utf8");
      const bootstrap = code.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
      try {
        await prior.exec(bootstrap);
        await prior.exec(fs.readFileSync(process.env.DELISH_PREVIOUS_SCHEMA, "utf8"));
        await prior.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
          ids.admin,
          "admin@synthetic.invalid",
        ]);
        await prior.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [
          ids.admin,
        ]);
        await prior.exec("SET ROLE authenticated");
        await prior.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [ids.admin]);
        const o = (
          await prior.query("SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r", [
            JSON.stringify({
              customer_name: "Existing order",
              customer_phone: "0790000000",
              method: "pickup",
              requested_date: "2026-11-01",
              requested_time: "14:00",
            }),
            JSON.stringify([line]),
          ])
        ).rows[0].r;
        await prior.exec("RESET ROLE");
        await prior.query("SELECT set_config('request.jwt.claim.sub','',false)");
        await prior.exec(schema);
        const saved = (
          await prior.query("SELECT total,customer_name FROM public.orders WHERE id=$1", [o.id])
        ).rows[0];
        assert.equal(Number(saved.total), 20);
        const type = (
          await prior.query(
            "SELECT pg_get_function_result(oid) AS result FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='rebuild_sales_order_atomic'",
          )
        ).rows;
        assert.equal(type.length, 1);
        assert.equal(type[0].result, "jsonb");
        return { existing_order: saved, rebuild_return_type: type[0].result };
      } finally {
        await prior.close();
      }
    },
  );
await db.close();
