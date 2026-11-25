import dotenv from 'dotenv'; import {fileURLToPath} from 'node:url'; import path from 'node:path';
dotenv.config({path:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.env')});
for (const key of ['DATABASE_URL','SESSION_SECRET']) if (!process.env[key]) throw new Error(`Missing ${key}`);
if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
export const env = {port:Number(process.env.PORT||4000),origin:process.env.CLIENT_ORIGIN||'http://localhost:5173',secret:process.env.SESSION_SECRET,production:process.env.NODE_ENV==='production',databaseUrl:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='true'};
