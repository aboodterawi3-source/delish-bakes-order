import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=process.env.DELISH_PROJECT_ROOT || process.cwd();
const schema=await readFile(root+'/supabase/standalone_complete_schema.sql','utf8');
// Execute the actual application's validator expression, without reimplementing it.
const ts=createRequire(root+'/package.json')('typescript');
const salesSource=await readFile(root+'/src/lib/sales.functions.ts','utf8');
const sf=ts.createSourceFile('sales.functions.ts',salesSource,ts.ScriptTarget.Latest,true);
let target,validator;
function findTarget(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='updateSalesOrderItemPrice')target=n;ts.forEachChild(n,findTarget);}
function findValidator(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='inputValidator')validator=n.arguments[0];ts.forEachChild(n,findValidator);}
findTarget(sf);findValidator(target);
const validatorJs=ts.transpileModule('const validate='+validator.getText(sf)+';globalThis.validate=validate;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const validatorContext={};vm.runInNewContext(validatorJs,validatorContext);
const validatorInput={orderId:'test-order',itemId:'test-item',expectedVersion:7,newUnitPrice:25,quantity:1};
const validatorOutput=validatorContext.validate(validatorInput);
const validatorObservation={input:validatorInput,output:validatorOutput,version_survives:Object.hasOwn(validatorOutput,'expectedVersion'),clear_notes_output:validatorContext.validate({orderId:'test-order',itemId:'test-item',expectedVersion:7,notes:''})};
const users={sales:'00000000-0000-4000-8000-000000000002',social:'00000000-0000-4000-8000-000000000004',kitchen:'00000000-0000-4000-8000-000000000003',visitor:'00000000-0000-4000-8000-000000000005'};
const observations=[];
async function bootstrap(db,extensionSchema=false){
 await db.exec(`
 CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
 GRANT ALL ON storage.buckets,storage.objects TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 `);
 if(extensionSchema)await db.exec('CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;');
 await db.exec(schema);
 for(const [role,id]of Object.entries(users)){
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,role+'@synthetic.invalid']);
  if(role!=='visitor')await db.query('INSERT INTO public.user_roles(user_id,role) VALUES($1,$2::public.app_role)',[id,role]);
 }
}
async function actor(db,role,uid,fn){
 await db.exec(`SET ROLE ${role}`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
 try{return await fn();}finally{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub','',false)");}
}
async function check(kind,name,fn){
 try{observations.push({kind,name,verified:true,evidence:await fn()});}
 catch(e){observations.push({kind,name,verified:false,error:e.message,code:e.code});process.exitCode=1;}
 console.log(JSON.stringify(observations.at(-1)));
}
async function reject(fn,rx){try{await fn();}catch(e){if(rx)assert.match(e.message,rx);return{code:e.code,message:e.message};}throw Error('Expected rejection');}
const db=new PGlite({extensions:{pgcrypto,uuid_ossp}});await bootstrap(db);
const line={name_ar:'Synthetic cake',name_en:'Synthetic cake',unit_price:20,quantity:1};
async function create(key,extra={},items=[line]){
 const order={customer_name:'Synthetic customer',customer_phone:'0790000000',method:'pickup',requested_date:'2026-11-01',requested_time:'14:00:00',client_request_id:key,...extra};
 const r=await actor(db,'authenticated',users.sales,()=>db.query('SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r',[JSON.stringify(order),JSON.stringify(items)]));return r.rows[0].r;
}
async function itemId(id){return(await db.query('SELECT id FROM public.order_items WHERE order_id=$1',[id])).rows[0].id;}
async function itemRpc(id,item,price,quantity,version,extra={},uid=users.sales){
 const e={name:null,options:null,notes:null,...extra};
 return actor(db,'authenticated',uid,()=>db.query('SELECT public.update_order_item_atomic(p_order_id=>$1,p_item_id=>$2,p_unit_price=>$3,p_quantity=>$4,p_expected_version=>$5,p_name_ar=>$6,p_options_ar=>$7,p_notes=>$8) AS r',[id,item,price,quantity,version,e.name,e.options,e.notes]));
}

// 1. Direct sensitive orders update blocked
await check('fixed','Sensitive direct order update is blocked without internal flag',async()=>{
 const o=await create('guard-confirmed');return reject(()=>actor(db,'authenticated',users.sales,()=>db.query('UPDATE public.orders SET deposit_paid=1234 WHERE id=$1',[o.id])),/Direct UPDATE of sensitive/);
});

// 2. Social actor atomically updates item specs
await check('fixed','Social actor can atomically update item name options and notes',async()=>{
 const o=await create('social-confirmed'),i=await itemId(o.id);await itemRpc(o.id,i,20,1,1,{name:'New name',options:['New filling'],notes:'New notes'},users.social);
 const r=await db.query('SELECT name_ar,options_ar,notes FROM public.order_items WHERE id=$1',[i]);assert.equal(r.rows[0].name_ar,'New name');assert.equal(r.rows[0].notes,'New notes');return r.rows[0];
});

// 3. Price amounts and simple phone masked in kitchen feed
await check('fixed','Price amounts and simple phone format are masked in kitchen feed',async()=>{
 const o=await create('mask-confirmed',{notes:'Contact 0790000000'}),i=await itemId(o.id);await itemRpc(o.id,i,30,1,1);
 const r=await actor(db,'authenticated',users.kitchen,()=>db.query('SELECT notes,modifications FROM public.get_kitchen_orders() WHERE id=$1',[o.id]));
 assert.equal(r.rows[0].notes,'Contact ***');assert.equal(r.rows[0].modifications[0].newValue,'*** (كمية: 1)');return r.rows[0];
});

// 4. Kitchen RPC masks formatted Jordanian phone numbers with spaces
await check('fixed','Kitchen RPC masks formatted Jordanian phone numbers with spaces',async()=>{
 const o=await create('formatted-phone-leak',{notes:'Contact 079 123 4567'});
 const r=await actor(db,'authenticated',users.kitchen,()=>db.query('SELECT notes FROM public.get_kitchen_orders() WHERE id=$1',[o.id]));
 assert.equal(r.rows[0].notes,'Contact ***');return r.rows[0];
});

// 5. Unauthorized discount refused
await db.query('INSERT INTO public.staff_permissions(user_id,allow_custom_discount,max_discount_percent) VALUES($1,false,0)',[users.sales]);
await check('fixed','Unauthorized discount is refused when allow_custom_discount is false',async()=>{
 const o=await create('discount-denied-confirmed');return reject(()=>actor(db,'authenticated',users.sales,()=>db.query('SELECT public.apply_order_discount_atomic($1,20,100,1)',[o.id])),/لا تملك صلاحية تطبيق الخصم/);
});

// 6. Discount cap bypass with inconsistent amount and percentage is rejected
await check('fixed','Discount cap cannot be bypassed with inconsistent amount and percentage',async()=>{
 await db.query('UPDATE public.staff_permissions SET allow_custom_discount=true,max_discount_percent=10 WHERE user_id=$1',[users.sales]);
 const o=await create('discount-cap-bypass');
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('SELECT public.apply_order_discount_atomic($1,20,1,1) AS r',[o.id])),
  /لا يتطابق مع النسبة|يتجاوز الحد المسموح/
 );
});

// 7. General patch RPC rejects discount exceeding staff cap
await check('fixed','General patch RPC rejects discount exceeding staff cap',async()=>{
 const o=await create('patch-discount-bypass');
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('SELECT public.patch_sales_order_atomic($1,$2::jsonb,$3::jsonb,$4,1) AS r',[o.id,JSON.stringify({discount_amount:20}),'[]',users.sales])),
  /لا تملك صلاحية|يتجاوز.*المسموح/
 );
});

// 8. Direct financial input column update on orders is blocked
await check('fixed','Direct financial column updates on orders are blocked by trigger',async()=>{
 const o=await create('direct-discount-input');
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('UPDATE public.orders SET discount_amount=20 WHERE id=$1',[o.id])),
  /Direct UPDATE of sensitive/
 );
});

// 9. Restricted product price change refused by item RPC
const product=(await db.query("INSERT INTO public.products(name_ar,name_en,slug,category,price) VALUES('Locked cake','Locked cake','locked-v5-cake','Cake',20) RETURNING id")).rows[0].id;
await db.query('INSERT INTO public.sales_product_permissions(user_id,product_id,can_edit_price) VALUES($1,$2,false)',[users.sales,product]);
await check('fixed','Restricted product price change is refused by new item RPC',async()=>{
 const o=await create('locked-price-confirmed',{},[{...line,product_id:product}]),i=await itemId(o.id);
 return reject(()=>itemRpc(o.id,i,1,1,1),/لا تملك صلاحية تعديل سعر هذا المنتج/);
});

// 10. Direct order_items update is blocked by trigger
await check('fixed','Direct order_items update is blocked by trigger',async()=>{
 const o=await create('direct-item-bypass',{},[{...line,product_id:product}]),i=await itemId(o.id);
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('UPDATE public.order_items SET unit_price=1 WHERE id=$1',[i])),
  /Direct mutation of order_items is prohibited/
 );
});

// 11. Rebuild RPC rejects restricted product price change
await check('fixed','Rebuild RPC rejects restricted product price change',async()=>{
 const o=await create('rebuild-price-bypass',{},[{...line,product_id:product}]);
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('SELECT public.rebuild_sales_order_atomic($1,$2::jsonb,1,0,0,1,$3,$4::jsonb)',[o.id,JSON.stringify([{...line,product_id:product,unit_price:1}]),users.sales,'[]'])),
  /لا تملك صلاحية تعديل سعر هذا المنتج/
 );
});

// 12. Rebuild RPC rejects submitted total that contradicts line sum
await check('fixed','Rebuild RPC rejects submitted total that contradicts line sum and subtotal',async()=>{
 const o=await create('rebuild-total-mismatch');
 return reject(
  ()=>actor(db,'authenticated',users.sales,()=>db.query('SELECT public.rebuild_sales_order_atomic($1,$2::jsonb,20,0,0,1,$3,$4::jsonb)',[o.id,JSON.stringify([line]),users.sales,'[]'])),
  /لا يطابق/
 );
});

// 13. Actual input validator preserves expectedVersion and stale item write is blocked
await check('fixed','Validator preserves expectedVersion and stale item write is rejected by OCC',async()=>{
 const observed=validatorObservation;
 assert.equal(observed.version_survives,true);
 assert.equal(observed.output.expectedVersion,7);
 const o=await create('validator-occ-check'),i=await itemId(o.id);
 await itemRpc(o.id,i,20,3,1); // moves version to 2
 return reject(
  ()=>itemRpc(o.id,i,25,1,1), // stale version 1
  /OCC_VERSION_MISMATCH/
 );
});

// 14. Clearing item notes via empty string successfully sets notes to null
await check('fixed','Clearing item notes via empty string successfully sets notes to null',async()=>{
 const o=await create('clear-notes-fixed',{},[{...line,notes:'Old note that should be removed'}]),i=await itemId(o.id);
 const observed=validatorObservation;
 assert.equal(observed.clear_notes_output.notes,'');
 await itemRpc(o.id,i,20,1,1,{notes:observed.clear_notes_output.notes});
 const r=await db.query('SELECT notes FROM public.order_items WHERE id=$1',[i]);
 assert.equal(r.rows[0].notes,null);
 return{saved_notes:r.rows[0].notes};
});

// 15. Full payment retry deduplicates and rejects new full-payment on settled order
await check('fixed','Full payment retry deduplicates and a new full-payment key on a settled order is rejected',async()=>{
 const o=await create('settlement-confirmed');
 const pay=key=>actor(db,'authenticated',users.sales,()=>db.query("SELECT public.record_order_payment_atomic(p_order_id=>$1,p_amount=>20,p_payment_type=>'full',p_idempotency_key=>$2) AS r",[o.id,key]));
 await pay('settle-key');const same=await pay('settle-key');assert.equal(same.rows[0].r.is_duplicate,true);
 const rejection=await reject(()=>pay('second-settle-key'),/already paid in full/);return{same_key_duplicate:true,rejection};
});

// 16. Customer edit atomic and rejects token reuse
await check('fixed','Customer edit is atomic on successful call with pgcrypto in public and rejects token reuse',async()=>{
 const o=await create('customer-edit-confirmed',{staff_notes:'INTERNAL STAFF NOTE'});
 const token='v5-synthetic-customer-token-'.padEnd(64,'x');const hash=createHash('sha256').update(token).digest('hex');
 await db.query("INSERT INTO public.order_edit_tokens(order_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[o.id,hash]);
 const r=await actor(db,'service_role',null,()=>db.query("SELECT public.submit_customer_order_edit_atomic(p_token=>$1,p_notes=>'Customer changed note') AS r",[token]));assert.equal(r.rows[0].r.version,2);
 const rejection=await reject(()=>actor(db,'service_role',null,()=>db.query('SELECT public.submit_customer_order_edit_atomic($1)',[token])),/already been used/);
 return{version:r.rows[0].r.version,rejection};
});

// 17. Customer token consumption rolls back when order write fails
await check('fixed','Customer token consumption rolls back when order write is forced to fail',async()=>{
 const o=await create('customer-rollback-confirmed');
 const token='v5-synthetic-rollback-token-'.padEnd(64,'x');const hash=createHash('sha256').update(token).digest('hex');
 await db.query("INSERT INTO public.order_edit_tokens(order_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[o.id,hash]);
 await db.exec("CREATE FUNCTION public.v5_qa_fault_order_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.notes='__FAIL_ORDER_WRITE__' THEN RAISE EXCEPTION 'Injected order write failure'; END IF; RETURN NEW; END $$;CREATE TRIGGER v5_qa_fault_order_write BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.v5_qa_fault_order_write();");
 const rejection=await reject(()=>actor(db,'service_role',null,()=>db.query("SELECT public.submit_customer_order_edit_atomic(p_token=>$1,p_notes=>'__FAIL_ORDER_WRITE__')",[token])),/Injected order write failure/);
 const r=await db.query('SELECT o.version,t.used_at FROM public.orders o JOIN public.order_edit_tokens t ON t.order_id=o.id WHERE o.id=$1',[o.id]);
 assert.equal(r.rows[0].version,1);assert.equal(r.rows[0].used_at,null);
 await db.exec('DROP TRIGGER v5_qa_fault_order_write ON public.orders;DROP FUNCTION public.v5_qa_fault_order_write();');return{...r.rows[0],rejection};
});

// 18. Customer-edit response is sanitized and excludes internal staff_notes and receipt_image_url
await check('fixed','Customer-edit response is sanitized and excludes internal staff_notes and receipt_image_url',async()=>{
 const o=await create('customer-response-leak',{staff_notes:'INTERNAL STAFF NOTE',receipt_image_url:'https://example.invalid/private-receipt'});
 const token='v5-synthetic-response-token-'.padEnd(64,'x');const hash=createHash('sha256').update(token).digest('hex');await db.query("INSERT INTO public.order_edit_tokens(order_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[o.id,hash]);
 const r=await actor(db,'service_role',null,()=>db.query("SELECT public.submit_customer_order_edit_atomic(p_token=>$1,p_notes=>'Updated') AS r",[token]));
 assert.equal(r.rows[0].r.staff_notes,undefined);
 assert.equal(r.rows[0].r.receipt_image_url,undefined);
 assert.equal(r.rows[0].r.notes,'Updated');
 assert.equal(r.rows[0].r.version,2);
 return{returned_keys:Object.keys(r.rows[0].r),version:r.rows[0].r.version};
});

// 19. Customer edit RPC revokes authenticated execute privilege
await check('fixed','Customer edit RPC revokes authenticated execute privilege under legacy default grants',async()=>{
 const r=await db.query("SELECT has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated FROM pg_proc WHERE proname='submit_customer_order_edit_atomic'");assert.equal(r.rows[0].authenticated,false);return r.rows[0];
});

// 20. Customer-edit RPC succeeds when pgcrypto is installed in extensions schema
const extended=new PGlite({extensions:{pgcrypto,uuid_ossp}});await bootstrap(extended,true);
await check('fixed','Customer-edit RPC succeeds when pgcrypto is installed in extensions schema',async()=>{
 const o=await actor(extended,'authenticated',users.sales,()=>extended.query('SELECT public.create_staff_order_atomic($1::jsonb,$2::jsonb) AS r',[JSON.stringify({customer_name:'Ext customer',customer_phone:'0790000000',method:'pickup',requested_date:'2026-11-01',requested_time:'14:00:00',client_request_id:'ext-token-order'}),JSON.stringify([line])]));
 const orderId=o.rows[0].r.id;
 const token='v5-synthetic-ext-token-'.padEnd(64,'x');
 const hash=createHash('sha256').update(token).digest('hex');
 await extended.query("INSERT INTO public.order_edit_tokens(order_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",[orderId,hash]);
 const r=await actor(extended,'service_role',null,()=>extended.query("SELECT public.submit_customer_order_edit_atomic(p_token=>$1,p_notes=>'Customer edit with extensions schema') AS r",[token]));
 assert.equal(r.rows[0].r.version,2);
 const e=await extended.query("SELECT extnamespace::regnamespace::text AS schema FROM pg_extension WHERE extname='pgcrypto'");
 return{pgcrypto_schema:e.rows[0].schema,version:r.rows[0].r.version};
});

await writeFile(root+'/independent-review-v5-results.json',JSON.stringify({environment:'Local PGlite. Separate SET ROLE/UID, represented Auth/Storage and legacy default grants. Separate extension-schema profile. No live Supabase.',observations},null,2));
await extended.close();await db.close();
