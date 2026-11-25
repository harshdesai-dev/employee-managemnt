import pg from 'pg'; import {env} from './config.js';
const {Pool}=pg;
export const pool=new Pool({connectionString:env.databaseUrl,ssl:env.ssl?{rejectUnauthorized:true}:false,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});
pool.on('error',e=>console.error('PostgreSQL pool error:',e.message));
