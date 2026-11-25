import bcrypt from 'bcryptjs'; import {z} from 'zod'; import {pool} from '../db.js';
try {
 const a=z.object({name:z.string().trim().min(2).max(120),email:z.string().email().max(255),password:z.string().min(12).max(128)}).parse({
 name:process.env.ADMIN_NAME||'PeopleOS Administrator',email:process.env.ADMIN_EMAIL||'admin@peopleos.local',password:process.env.ADMIN_PASSWORD||'ChangeMe123!'});
 if(a.password==='ChangeMe123!') console.warn('WARNING: demo password in use. Change ADMIN_PASSWORD before deployment.');
 const hash=await bcrypt.hash(a.password,12);
 await pool.query(`INSERT INTO users(name,email,password_hash) VALUES($1,LOWER($2),$3) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,updated_at=NOW()`,[a.name,a.email,hash]);
 console.log('Admin account ready:',a.email);
} catch(e){console.error('Seed failed:',e.message);process.exitCode=1;} finally{await pool.end();}
