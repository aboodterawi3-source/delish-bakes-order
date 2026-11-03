const dynamicToday = new Date().toISOString().slice(0, 10);
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
const output = process.env.DELISH_REVIEW_OUTPUT || path.resolve('results_v8.json');
const ts = createRequire(root + '/package.json')('typescript');
const nativeRequire = createRequire(import.meta.url);
const schema = fs.readFileSync(root + '/supabase/standalone_complete_schema.sql', 'utf8');
const ids = {admin:'00000000-0000-4000-8000-000000000001',sales:'00000000-0000-4000-8000-000000000002',kitchen:'00000000-0000-4000-8000-000000000003',social:'00000000-0000-4000-8000-000000000004',visitor:'00000000-0000-4000-8000-000000000005'};
const observations = [];
const rpcTrace = [];
const db = new PGlite({extensions:{pgcrypto,uuid_ossp}});
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
for (const [role,id] of Object.entries(ids)) {
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,role+'@synthetic.invalid']);
 if(role!=='visitor') await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2::public.app_role)',[id,role]);
}
await db.query('INSERT INTO public.staff_permissions(user_id,allow_price_override,allow_custom_discount,max_discount_percent) VALUES($1,false,false,0)',[ids.sales]);
async function actor(role,uid,fn) {
 await db.exec('SET ROLE '+role);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid || '']);
 try{return await fn();}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}
}
async function check(kind,name,fn) {
 try{observations.push({kind,name,verified:true,evidence:await fn()});}
 catch(e){observations.push({kind,name,verified:false,error:e.message,code:e.code});process.exitCode=1;}
 fs.writeFileSync(output,JSON.stringify({environment:'Exact standalone SQL on local PGlite; distinct SET ROLE and UID; modeled Auth/Storage and legacy grants. Actual application TS validators and handlers executed with a local SQL-backed Supabase adapter; framework HTTP/auth middleware bypassed. No real Supabase and no browser E2E.',observations},null,2));
 console.log(JSON.stringify(observations.at(-1)));
}
async function reject(fn,rx) {try{await fn();}catch(e){if(rx) assert.match(e.message,rx);return{code:e.code,message:e.message};}throw Error('Expected rejection');}
const line = {name_ar:'Synthetic cake',name_en:'Synthetic cake',unit_price:20,quantity:1};
async function create(extra={},items=[line],uid=ids.sales) {
 const order={customer_name:'Synthetic customer',customer_phone:'0790000000',method:'pickup',requested_date:'2026-11-01',requested_time:'14:00:00',client_request_id:randomUUID(),...extra};
 return (await actor('authenticated',uid,()=>db.query('SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r',[JSON.stringify(order),JSON.stringify(items)]))).rows[0].r;
}
async function state(id){return(await db.query('SELECT o.*, (SELECT jsonb_agg(i) FROM public.order_items i WHERE i.order_id=o.id) AS order_items FROM public.orders o WHERE id=$1',[id])).rows[0];}
async function patch(id,p,version=1){return(await actor('authenticated',ids.sales,()=>db.query('SELECT public.patch_sales_order_atomic($1,$2::jsonb,$3::jsonb,$4,$5) AS r',[id,JSON.stringify(p),'[]',ids.sales,version]))).rows[0].r;}
async function item(id,p={}) {
 const s=await state(id),i=s.order_items[0];
 const a={p_order_id:id,p_item_id:i.id,p_unit_price:Number(i.unit_price),p_expected_version:s.version,...p};
 const keys=Object.keys(a),values=keys.map(k=>a[k]);
 return(await actor('authenticated',ids.sales,()=>db.query('SELECT public.update_order_item_atomic('+keys.map((k,i)=>k+'=>$'+(i+1)).join(',')+') AS r',values))).rows[0].r;
}

// SQL-backed adapter: every requested table/RPC operation executes against the delivered database.
const ident=s=>{if(!/^[a-z_][a-z0-9_]*$/i.test(s))throw Error('Invalid SQL identifier');return '"'+s+'"';};
function postgrestValue(value,key='') {
 if(value instanceof Date)return ['requested_date','event_date'].includes(key)?value.toISOString().slice(0,10):value.toISOString();
 if(Array.isArray(value))return value.map(x=>postgrestValue(x,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,postgrestValue(v,k)]));
 return value;
}
function adapter(uid,role='authenticated') {
 const respond=async fn=>{try{return{data:await actor(role,uid,fn),error:null};}catch(e){return{data:null,error:{code:e.code,message:e.message}};}};
 const make=(table,rpc)=>{
  const filters=[],orders=[];let single=false,maybe=false,selected='*',offset=0,limit=null,mutation=null,payload=null;
  const q={
   select(s='*'){selected=s;return q;},eq(k,v){filters.push([k,'=',v]);return q;},in(k,v){filters.push([k,'IN',v]);return q;},gte(k,v){filters.push([k,'>=',v]);return q;},lte(k,v){filters.push([k,'<=',v]);return q;},
   order(k,opts={}){orders.push(ident(k)+(opts.ascending===false?' DESC':' ASC'));return q;},limit(n){limit=n;return q;},range(a,b){offset=a;limit=b-a+1;return q;},
   single(){single=true;return q;},maybeSingle(){single=true;maybe=true;return q;},
   insert(p){mutation='INSERT';payload=p;return q;},update(p){mutation='UPDATE';payload=p;return q;},delete(){mutation='DELETE';return q;},
   then(ok,bad){return respond(async()=>{
    const vals=[];const add=v=>{vals.push(v);return '$'+vals.length;};
    let from;
    if(rpc){
     const args=Object.entries(rpc.args||{}).filter(([,v])=>v!==undefined).map(([k,v])=>{
      const json=['p_order','p_items','p_patch','p_new_mods','p_lines'].includes(k);
      return ident(k)+'=>'+add(json&&v!==null?JSON.stringify(v):v)+(json?'::jsonb':'');
     });
     from='public.'+ident(rpc.name)+'('+args.join(',')+')';
    }else from='public.'+ident(table);
    let statement;
    if(mutation==='INSERT'){
     const keys=Object.keys(payload);statement='INSERT INTO '+from+'('+keys.map(ident).join(',')+') VALUES('+keys.map(k=>add(typeof payload[k]==='object'&&payload[k]!==null?JSON.stringify(payload[k]):payload[k])).join(',')+')';
    }else if(mutation==='UPDATE')statement='UPDATE '+from+' SET '+Object.entries(payload).map(([k,v])=>ident(k)+'='+add(typeof v==='object'&&v!==null?JSON.stringify(v):v)).join(',');
    else if(mutation==='DELETE')statement='DELETE FROM '+from;
    else if(rpc&&!['get_kitchen_orders','get_kitchen_order_items'].includes(rpc.name))statement='SELECT '+from+' AS r';
    else statement='SELECT * FROM '+from;
    if(filters.length)statement+=' WHERE '+filters.map(([k,op,v])=>op==='IN'?ident(k)+' IN ('+v.map(add).join(',')+')':ident(k)+op+add(v)).join(' AND ');
    if(!mutation){if(orders.length)statement+=' ORDER BY '+orders.join(',');if(limit!==null)statement+=' LIMIT '+Number(limit);if(offset)statement+=' OFFSET '+Number(offset);}
    else statement+=' RETURNING *';
    const raw=await db.query(statement,vals);const r={rows:raw.rows.map(row=>postgrestValue(row))};
    if(rpc&&!['get_kitchen_orders','get_kitchen_order_items'].includes(rpc.name))return r.rows[0]?.r ?? null;
    if(table==='orders'&&selected.includes('order_items('))for(const row of r.rows)row.order_items=(await db.query('SELECT * FROM public.order_items WHERE order_id=$1',[row.id])).rows;
    if(single){if(r.rows.length!==1&&!maybe)throw Error('Expected one row');return r.rows[0]||null;}return r.rows;
   }).then(ok,bad);}
  };return q;
 };
 return{from:table=>make(table),rpc:(name,args)=>{rpcTrace.push({uid,name,args:JSON.parse(JSON.stringify(args||{}))});return make(null,{name,args});}};
}

// Run the actual modules, replacing only framework registration/environment plumbing.
// Role, price permission, discount authorization, validators, handlers and SQL are original code.
const modules=new Map();
function loadApp(file) {
 const full=path.join(root,file);if(modules.has(full))return modules.get(full).exports;
 const m={exports:{}};modules.set(full,m);
 let source=fs.readFileSync(full,'utf8').replaceAll('import.meta','({env:{}})');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const req=spec=>{
  if(spec==='@tanstack/react-start')return{createServerFn:()=>{const d={middleware(){return d;},validator(v) { d.validate = v; return d; }, inputValidator(v) {d.validate=v;return d;},handler(h){d.run=async(input,context)=>h({data:d.validate?d.validate(input):input,context});return d;}};return d;}};
  if(spec==='@tanstack/react-start/server')return{getRequestHeader:()=>undefined};
  if(spec==='@/integrations/supabase/auth-middleware')return{requireSupabaseAuth:{}};
  if(spec==='@/integrations/supabase/client.server')return{supabaseAdmin:adapter(null,'service_role')};
  if(spec.startsWith('@/'))return loadApp('src/'+spec.slice(2)+'.ts');
  return nativeRequire(spec);
 };
 vm.runInNewContext('(function(require,module,exports){'+compiled+'\n})',{console,process,URL,Headers,Request,TextEncoder,TextDecoder,crypto:webcrypto,setTimeout,clearTimeout,fetch}, {filename:full})(req,m,m.exports);
 return m.exports;
}
const app=loadApp('src/lib/sales.functions.ts');
const ctx=uid=>({userId:uid,claims:{sub:uid,email:Object.entries(ids).find(([,id])=>id===uid)?.[0]+'@synthetic.invalid'},supabase:adapter(uid)});
const baseInput=()=>({customer_name:'Boundary synthetic',customer_phone:'0790000000',method:'pickup',requested_date:'2026-11-01',requested_time:'14:00',client_request_id:randomUUID(),items:[{name_ar:'Synthetic cake',quantity:1,unit_price:20}]});

const evaluate=(expression,bindings={})=>{
 const code=ts.transpileModule('const result='+expression+';globalThis.result=result;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const c={...bindings};vm.runInNewContext(code,c);return c.result;
};
function sourceParts(file){
 const text=fs.readFileSync(root+'/'+file,'utf8');const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const variables=new Map(),attributes=[];
 function visit(n){
  if(ts.isVariableDeclaration(n)&&n.initializer)variables.set(n.name.getText(sf),n.initializer.getText(sf));
  if(ts.isJsxAttribute(n)&&n.initializer?.expression)attributes.push({name:n.name.getText(sf),expression:n.initializer.expression.getText(sf)});
  ts.forEachChild(n,visit);
 }visit(sf);return{text,variables,attributes};
}
const mod=sourceParts('src/components/staff/ModificationsPanel.tsx');
const builder=sourceParts('src/components/staff/WebsiteRebuildPanel.tsx');

await check('fixed','Current schema reapplies cleanly on a current-version database',async()=>{await db.exec(schema);return{reapplied:true};});

const locked=(await db.query("INSERT INTO public.products(name_ar,name_en,slug,category,price) VALUES('Locked cake','Locked cake','locked-v8','Cake',20) RETURNING id")).rows[0].id;
for(const uid of [ids.sales,ids.social])await db.query('INSERT INTO public.sales_product_permissions(user_id,product_id,can_edit_price) VALUES($1,$2,false)',[uid,locked]);
await check('fixed','Manual unlink of a visible product is rejected for sales and social roles',async()=>{
 const o=await create({},[{...line,product_id:locked}]),s=await state(o.id),i=s.order_items[0],evidence={};
 for(const role of ['sales','social'])evidence[role]=await reject(()=>actor('authenticated',ids[role],()=>db.query('UPDATE public.order_items SET product_id=NULL WHERE id=$1',[i.id])),/Direct mutation/);
 assert.equal((await state(o.id)).order_items[0].product_id,locked);return evidence;
});
await check('fixed','Real catalog deletion preserves order and clears product link',async()=>{
 const p=(await db.query("INSERT INTO public.products(name_ar,name_en,slug,category,price) VALUES('Delete cake','Delete cake','delete-v8','Cake',20) RETURNING id")).rows[0].id;
 const o=await create({},[{...line,product_id:p}]);await actor('authenticated',ids.sales,()=>db.query('DELETE FROM public.products WHERE id=$1',[p]));const s=await state(o.id);assert.equal(s.order_items[0].product_id,null);assert.equal(Number(s.total),20);return{total:s.total,product_id:s.order_items[0].product_id};
});
await check('fixed','RLS-hidden catalog product direct unlink is strictly blocked and social employee cannot bypass locked price',async()=>{
 const o=await create({},[{...line,product_id:locked}]),s=await state(o.id),i=s.order_items[0];
 await db.query('UPDATE public.products SET is_available=false WHERE id=$1',[locked]);
 const visibility=await actor('authenticated',ids.social,()=>db.query('SELECT id FROM public.products WHERE id=$1',[locked]));assert.equal(visibility.rows.length,0);
 const denied=await reject(()=>app.updateSalesOrderItemPrice.run({orderId:o.id,itemId:i.id,expectedVersion:1,newUnitPrice:1},ctx(ids.social)),/لا تملك صلاحية تعديل سعر هذا المنتج/);
 const unlinkRejection=await reject(()=>actor('authenticated',ids.social,()=>db.query('UPDATE public.order_items SET product_id=NULL WHERE id=$1',[i.id])),/Direct mutation/);
 const currentItem=(await state(o.id)).order_items[0];assert.equal(currentItem.product_id,locked);
 const repricingStillDenied=await reject(()=>app.updateSalesOrderItemPrice.run({orderId:o.id,itemId:i.id,expectedVersion:1,newUnitPrice:1},ctx(ids.social)),/لا تملك صلاحية تعديل سعر هذا المنتج/);
 const finalOrder=await state(o.id);assert.equal(Number(finalOrder.total),20);
 return{role:'social',initial_repricing_rejected:denied,unlink_rejected:unlinkRejection,locked_link_preserved:currentItem.product_id===locked,repricing_still_denied:repricingStillDenied,final_total:finalOrder.total};
});
await check('fixed','Website builder now sends draft version and rejects newer order overwrite',async()=>{
 const o=await create(),s=await state(o.id);let draft;
 evaluate(builder.variables.get('importCurrent'),{order:{...s,items:s.order_items},setLines:v=>{draft=v;}})();
 await item(o.id,{p_quantity:3});let sent;
 const parent=evaluate(mod.attributes.find(a=>a.name==='onReplaceItems').expression,{selected:{id:o.id,version:2},rebuild:{mutate:v=>{sent=v;}}});
 const wrap=evaluate(mod.variables.get('handleReplaceItems'),{pendingSelfMutationRef:{current:false},initialVersionRef:{current:1},onReplaceItems:parent});
 const button=builder.attributes.find(a=>a.name==='onClick'&&a.expression.includes('onReplace(lines.map'));
 evaluate(button.expression,{onReplace:wrap,lines:draft})();assert.equal(sent.expectedVersion,1);
 const rejection=await reject(()=>app.replaceSalesOrderItems.run(sent,ctx(ids.sales)),/تعارض/);assert.equal((await state(o.id)).order_items[0].quantity,3);return{sent_version:sent.expectedVersion,preserved_quantity:3,rejection};
});
async function editorCase(refreshFirst){
 const initial=await app.createSalesOrder.run(baseInput(),ctx(ids.sales)),o=initial;
 await app.updateSalesOrder.run({orderId:o.id,expected_version:1,customer_name:'COLLEAGUE NEW CUSTOMER NAME'},ctx(ids.admin));
 const latest=await state(o.id);assert.equal(latest.version,2);
 const pending={current:false},version={current:1};let request;
 const start=evaluate(mod.variables.get('handleItemPatch'),{pendingSelfMutationRef:pending,initialVersionRef:version,onItemPatch:p=>{request={orderId:o.id,...p};}});
 start({itemId:initial.items[0].id,quantity:2});assert.equal(pending.current,true);
 const sf=ts.createSourceFile('ModificationsPanel.tsx',mod.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect,errorCallback;
 function visit(n){
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[0]?.getText(sf).includes('if (pendingSelfMutationRef.current)'))effect=n.arguments[0].getText(sf);
  if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='saveItem'){
   const opts=n.initializer.arguments[0];for(const p of opts.properties)if(p.name?.getText(sf)==='onError')errorCallback=p.initializer.getText(sf);
  }
  ts.forEachChild(n,visit);
 }visit(sf);assert.ok(effect);assert.ok(errorCallback);
 const applyRefresh=()=>evaluate(effect,{pendingSelfMutationRef:pending,initialVersionRef:version,order:latest})();
 if(refreshFirst)applyRefresh();
 const rejection=await reject(()=>app.updateSalesOrderItemPrice.run(request,ctx(ids.sales)),/OCC_VERSION_MISMATCH/);
 evaluate(errorCallback,{toast:{error:()=>{}}})(new Error(rejection.message));const pendingAfterError=pending.current;
 if(!refreshFirst){assert.equal(pending.current,true);applyRefresh();}
 assert.equal(version.current,1);assert.equal(pending.current,false);
 const conflict=evaluate(mod.variables.get('hasConcurrentConflict'),{pendingSelfMutationRef:pending,initialVersionRef:version,order:latest});assert.equal(conflict,true);
 const finishParent=evaluate(mod.variables.get('handleFinishEdit'),{selectedId:o.id,selected:latest,save:{mutateAsync:input=>app.updateSalesOrder.run(input,ctx(ids.sales))},toast:{success:()=>{},error:()=>{}},onCloseEdit:undefined});
 let finishPayload;
 const finish=evaluate(mod.variables.get('handleFinish'),{setIsFinishing:()=>{},onFinishEdit:async p=>{finishPayload=p;return finishParent(p);},order:latest,orderName:initial.order_name||'',customerName:initial.customer_name,customerPhone:initial.customer_phone,senderPhone:initial.sender_phone||'',recipientPhone:initial.recipient_phone||'',initialVersionRef:version,date:initial.requested_date,time:initial.requested_time.slice(0,5),address:initial.address||'',inscription:initial.inscription||'',cardNote:initial.card_note||'',notes:initial.notes||'',staffNotes:initial.staff_notes||''});
 const finishRejection=await reject(()=>finish(),/OCC_VERSION_MISMATCH|تعارض/);const saved=await state(o.id);assert.equal(saved.customer_name,'COLLEAGUE NEW CUSTOMER NAME');assert.equal(saved.version,2);
 return{refresh_before_rejection:refreshFirst,first_item_write_rejected:rejection,pending_flag_after_error:pendingAfterError,preserved_draft_version:version.current,conflict_warning:conflict,finish_rejection:finishRejection,colleague_name_preserved:saved.customer_name,final_version:saved.version};
}
await check('fixed','Failed self-mutation preserves colleague edits and refuses stale overwrite whether refresh arrives before or after rejection',async()=>({error_then_refresh:await editorCase(false),refresh_then_error:await editorCase(true)}));
await check('fixed','Consecutive successful item mutations advance version cleanly without false conflict',async()=>{
 const o=await create();
 const s0=await state(o.id);
 const first=await app.updateSalesOrderItemPrice.run({orderId:o.id,itemId:s0.order_items[0].id,expectedVersion:1,quantity:2},ctx(ids.sales));
 assert.equal(first.version,2);
 const second=await app.updateSalesOrderItemPrice.run({orderId:o.id,itemId:s0.order_items[0].id,expectedVersion:2,quantity:3},ctx(ids.sales));
 assert.equal(second.version,3);
 const s=await state(o.id);
 assert.equal(s.version,3);
 assert.equal(s.order_items[0].quantity,3);
 const finish=await app.updateSalesOrder.run({orderId:o.id,expected_version:3,customer_name:'Successfully Updated'},ctx(ids.sales));
 assert.equal(finish.version,4);
 assert.equal(finish.customer_name,'Successfully Updated');
 return{first_version:first.version,second_version:second.version,final_version:finish.version,customer_name:finish.customer_name};
});
await check('fixed','Phone and price in social order description are masked in actual kitchen feed',async()=>{
 const today=loadApp('src/lib/date-filter.ts').todayIso();
 const o=await loadApp('src/lib/social.functions.ts').createSocialOrder.run({client_request_id:randomUUID(),customer_name:'Synthetic customer',customer_phone:'0790000000',order_details:'Chocolate cake; contact 079 123 4567; 40 د.أ',quantity:1,unit_price:20,method:'pickup',payment_option:'cash',requested_date:today,requested_time:'14:00',is_urgent:false},ctx(ids.social));
 const feed=await loadApp('src/lib/kds.functions.ts').getKitchenOrders.run(undefined,ctx(ids.kitchen));const row=feed.find(x=>x.id===o.id);assert.ok(row);assert.equal(row.items[0].name_ar.includes('079'),false);assert.equal(row.items[0].name_ar.includes('40'),false);return{name_ar:row.items[0].name_ar,name_en:row.items[0].name_en};
});
await check('fixed','General patch rejects inconsistent percentage and amount without changing order',async()=>{
 await db.query('UPDATE public.staff_permissions SET allow_custom_discount=true,max_discount_percent=10 WHERE user_id=$1',[ids.sales]);
 const o=await create();const r=await reject(()=>patch(o.id,{discount_amount:0,discount_percent:10}),/لا يتطابق/);const s=await state(o.id);assert.equal(Number(s.total),20);assert.equal(s.version,1);return{rejection:r,total:s.total,version:s.version};
});
await check('fixed','Preapproved percentage discount remains authorized identically through item and rebuild paths',async()=>{
 await db.query('UPDATE public.staff_permissions SET allow_custom_discount=false,max_discount_percent=0 WHERE user_id=$1',[ids.sales]);const orders=[await create(),await create()];
 for(const o of orders)await actor('authenticated',ids.admin,()=>db.query('SELECT public.apply_order_discount_atomic($1,4,20,1)',[o.id]));
 const a=await state(orders[0].id);const itemResult=await app.updateSalesOrderItemPrice.run({orderId:a.id,itemId:a.order_items[0].id,expectedVersion:2,quantity:2},ctx(ids.sales));
 const rebuildResult=await app.replaceSalesOrderItems.run({orderId:orders[1].id,expectedVersion:2,lines:[{name:'Synthetic cake',unitPrice:20,quantity:2}]},ctx(ids.sales));assert.equal(itemResult.total,32);assert.equal(rebuildResult.total,32);return{item_total:itemResult.total,rebuild_total:rebuildResult.total};
});
if(process.env.DELISH_PREVIOUS_SCHEMA)await check('fixed','Upgrade from the preceding actual schema preserves an existing order and removes the old overloads',async()=>{
 const prior=new PGlite({extensions:{pgcrypto,uuid_ossp}});const code=fs.readFileSync(new URL(import.meta.url),'utf8');const bootstrap=code.match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
 try{
  await prior.exec(bootstrap);await prior.exec(fs.readFileSync(process.env.DELISH_PREVIOUS_SCHEMA,'utf8'));
  await prior.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[ids.admin,'admin@synthetic.invalid']);await prior.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",[ids.admin]);
  await prior.exec('SET ROLE authenticated');await prior.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids.admin]);
  const o=(await prior.query('SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r',[JSON.stringify({customer_name:'Existing order',customer_phone:'0790000000',method:'pickup',requested_date:'2026-11-01',requested_time:'14:00'}),JSON.stringify([line])])).rows[0].r;
  await prior.exec('RESET ROLE');await prior.query("SELECT set_config('request.jwt.claim.sub','',false)");await prior.exec(schema);
  const saved=(await prior.query('SELECT total,customer_name FROM public.orders WHERE id=$1',[o.id])).rows[0];assert.equal(Number(saved.total),20);
  const funcs=(await prior.query("SELECT proname,count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('patch_sales_order_atomic','rebuild_sales_order_atomic','update_order_item_atomic','apply_order_discount_atomic') GROUP BY proname")).rows;
  assert.equal(funcs.length,4);assert.ok(funcs.every(f=>f.n===1));return{existing_order:saved,function_counts:funcs};
 }finally{await prior.close();}
});
await db.close();
