import fs from 'node:fs/promises'; import {pool} from '../db.js';
try { const sql=await fs.readFile(new URL('../../../database/migrations/001_initial.sql',import.meta.url),'utf8'); await pool.query(sql); console.log('Migration applied.'); }
catch(e){console.error('Migration failed:',e.message);process.exitCode=1;} finally{await pool.end();}
