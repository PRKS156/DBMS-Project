const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const jwt = require('jsonwebtoken');
let state, released, claims;
const accounts = {1:{id:1, role:'PATIENT',isActive:true},2:{id:2,role:'DOCTOR',isActive:true},3:{id:3,role:'PATIENT',isActive:true},4:{id:4,role:'PATIENT',isActive:false}};
const db = {
 user:{findUnique:async ({where})=>accounts[where.id]},
 emergencyAlert:{findUnique:async()=>({id:10,patient:{userId:1},dispatchRecord:{doctor:{userId:2}}}),updateMany:async({where,data})=>{claims=where;if(!where.status.in.includes(state))return {count:0};state=data.status;return {count:1};}},
 dispatchRecord:{findUnique:async()=>({doctorId:2,vehicleId:1}),updateMany:async()=>({count:1})},
 doctorProfile:{findUnique:async()=>({isOnDuty:true,isActive:true}),update:async()=>{released++;}},
 vehicle:{update:async()=>{released++;}},
 $transaction:async fn=>fn(db)
};
require.cache[require.resolve('../config/db')]={exports:db};
const access = require('../middleware/access');
const alerts = require('../controllers/alertController');
const auth = require('../controllers/authController');
const token=id=>jwt.sign({userId:id,role:accounts[id].role},process.env.JWT_SECRET);
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const request=(id)=>({params:{id:'10'},body:{},headers:id?{authorization:'Bearer '+token(id)}:{},app:{locals:{}}});
test('public registration rejects privileged roles',async()=>{for(const role of ['ADMIN','DISPATCHER']){const res=response();await auth.register({body:{email:'test@example.com',password:'test-password',role}},res);assert.equal(res.statusCode,403);}});
test('profiles require an active owner and reject other patients',async()=>{for(const id of [null,3,4]){const req=request(id);req.params.id='1';const res=response();let passed=false;await access.profile('patient')(req,res,()=>{passed=true;});assert.equal(passed,false);assert.ok([401,403].includes(res.statusCode));}});
test('only assigned doctor may change clinical state',async()=>{for(const id of [null,1,3]){const res=response();await access.alert('doctor')(request(id),res,()=>assert.fail('unauthorized'));assert.equal(res.statusCode,403);}let passed=false;await access.alert('doctor')(request(2),response(),()=>{passed=true;});assert.ok(passed);});
test('tracking token is limited to its own alert and cannot complete',async()=>{const req=request();req.headers['x-tracking-token']=jwt.sign({role:'ALERT_TRACKER',alertId:10},process.env.JWT_SECRET);let passed=false;await access.alert()(req,response(),()=>{passed=true;});assert.ok(passed);await access.alert('doctor')(req,response(),()=>assert.fail());req.params.id='11';const res=response();await access.alert()(req,res,()=>assert.fail());assert.equal(res.statusCode,403);});
test('full lifecycle and resource release; repeats cannot release twice',async()=>{state='PENDING';released=0;const req=request(2);req.user={userId:2,role:'DOCTOR'};for(const fn of ['acknowledgeAlert','transportAlert','completeAlert']){const res=response();await alerts[fn](req,res);assert.equal(res.statusCode,200,JSON.stringify(res.body));}assert.equal(state,'COMPLETED');assert.equal(released,2);const res=response();await alerts.completeAlert(req,res);assert.equal(res.statusCode,409);assert.equal(released,2);assert.equal(claims.dispatchRecord.is.doctor.is.userId,2);});
test('concurrent cancellation releases resources once',async()=>{state='PENDING';released=0;const responses=[response(),response()];await Promise.all(responses.map(res=>alerts.cancelAlert(request(1),res)));assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);assert.equal(released,2);});
test('invalid transport transition is rejected',async()=>{state='PENDING';const res=response();await alerts.transportAlert(request(2),res);assert.equal(res.statusCode,409);assert.equal(state,'PENDING');});
