import express from 'express'; import session from 'express-session'; import connectPgSimple from 'connect-pg-simple'; import cors from 'cors'; import helmet from 'helmet'; import bcrypt from 'bcryptjs'; import rateLimit from 'express-rate-limit';
import {pool} from './db.js'; import {env} from './config.js'; import {loginSchema,employeeSchema} from './validation.js';
const app=express(),PgStore=connectPgSimple(session);
app.disable('x-powered-by'); if(env.production)app.set('trust proxy',1);
app.use(helmet()); app.use(cors({origin:env.origin,credentials:true})); app.use(express.json({limit:'100kb'}));
app.use(session({name:'peopleos.sid',store:new PgStore({pool,tableName:'user_sessions',createTableIfMissing:true}),secret:env.secret,resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:'lax',secure:env.production,maxAge:8*60*60*1000}}));
const auth=(req,res,next)=>req.session?.user?next():res.status(401).json({error:'Authentication required.'});
const loginLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many login attempts. Try again in 15 minutes.'}});
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const selectFields=`id,employee_code,full_name,email,phone,department,designation,salary::float8 AS salary,TO_CHAR(joining_date,'YYYY-MM-DD') AS joining_date,status,created_at,updated_at`;
app.get('/health',asyncRoute(async(req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});}));
app.post('/api/auth/login',loginLimit,asyncRoute(async(req,res)=>{
 const p=loginSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Enter a valid email and password.'});
 const q=await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1',[p.data.email.toLowerCase()]);
 const u=q.rows[0];if(!u||!await bcrypt.compare(p.data.password,u.password_hash))return res.status(401).json({error:'Invalid email or password.'});
 await new Promise((ok,no)=>req.session.regenerate(e=>e?no(e):ok()));
 req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};res.json({user:req.session.user});
}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.session.user}));
app.post('/api/auth/logout',auth,(req,res,next)=>req.session.destroy(e=>{if(e)return next(e);res.clearCookie('peopleos.sid',{httpOnly:true,sameSite:'lax',secure:env.production});res.status(204).end();}));
app.get('/api/dashboard/stats',auth,asyncRoute(async(req,res)=>{
 const r=await pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='Active')::int active,COUNT(*) FILTER(WHERE status='On Leave')::int on_leave,COUNT(*) FILTER(WHERE status='Inactive')::int inactive,COUNT(DISTINCT department)::int departments FROM employees`);
 const d=await pool.query('SELECT department,COUNT(*)::int count FROM employees GROUP BY department ORDER BY count DESC,department');
 res.json({...r.rows[0],departments:d.rows});
}));
app.get('/api/employees',auth,asyncRoute(async(req,res)=>{
 const page=Math.max(1,Number.parseInt(req.query.page)||1),limit=Math.max(1,Math.min(50,Number.parseInt(req.query.limit)||10)),offset=(page-1)*limit;
 const search=String(req.query.search||'').trim().slice(0,100),department=String(req.query.department||'').trim().slice(0,80),status=String(req.query.status||'');
 const w=[],v=[];if(search){v.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%');w.push(`(full_name ILIKE $${v.length} OR email ILIKE $${v.length} OR employee_code ILIKE $${v.length})`);}
 if(department){v.push(department);w.push(`department=$${v.length}`);}if(['Active','On Leave','Inactive'].includes(status)){v.push(status);w.push(`status=$${v.length}`);}
 const where=w.length?'WHERE '+w.join(' AND '):'',count=await pool.query(`SELECT COUNT(*)::int total FROM employees ${where}`,v);
 const values=[...v,limit,offset],data=await pool.query(`SELECT ${selectFields} FROM employees ${where} ORDER BY created_at DESC,id DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
 res.json({employees:data.rows,pagination:{page,limit,total:count.rows[0].total,pages:Math.ceil(count.rows[0].total/limit)}});
}));
app.get('/api/employees/:id',auth,asyncRoute(async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid employee ID.'});const r=await pool.query(`SELECT ${selectFields} FROM employees WHERE id=$1`,[id]);if(!r.rowCount)return res.status(404).json({error:'Employee not found.'});res.json({employee:r.rows[0]});}));
app.post('/api/employees',auth,asyncRoute(async(req,res)=>{
 const p=employeeSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:p.error.issues[0]?.message||'Invalid employee data.'});const e=p.data;
 try{const r=await pool.query(`INSERT INTO employees(employee_code,full_name,email,phone,department,designation,salary,joining_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${selectFields}`,[e.employee_code,e.full_name,e.email,e.phone,e.department,e.designation,e.salary,e.joining_date,e.status]);res.status(201).json({employee:r.rows[0]});}
 catch(err){if(err.code==='23505')return res.status(409).json({error:'Employee code or email already exists.'});throw err;}
}));
app.put('/api/employees/:id',auth,asyncRoute(async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid employee ID.'});
 const p=employeeSchema.safeParse(req.body);if(!p.success)return res.status(400).json({error:p.error.issues[0]?.message||'Invalid employee data.'});const e=p.data;
 try{const r=await pool.query(`UPDATE employees SET employee_code=$1,full_name=$2,email=$3,phone=$4,department=$5,designation=$6,salary=$7,joining_date=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING ${selectFields}`,[e.employee_code,e.full_name,e.email,e.phone,e.department,e.designation,e.salary,e.joining_date,e.status,id]);if(!r.rowCount)return res.status(404).json({error:'Employee not found.'});res.json({employee:r.rows[0]});}
 catch(err){if(err.code==='23505')return res.status(409).json({error:'Employee code or email already exists.'});throw err;}
}));
app.delete('/api/employees/:id',auth,asyncRoute(async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid employee ID.'});const r=await pool.query('DELETE FROM employees WHERE id=$1',[id]);if(!r.rowCount)return res.status(404).json({error:'Employee not found.'});res.status(204).end();}));
app.use((req,res)=>res.status(404).json({error:'Route not found.'}));
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).json({error:'An unexpected server error occurred.'});});
export default app;
