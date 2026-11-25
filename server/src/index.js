import app from './app.js';import {env} from './config.js';import {pool} from './db.js';
const server=app.listen(env.port,()=>console.log(`PeopleOS API listening on http://localhost:${env.port}`));
async function stop(signal){console.log(`${signal}: shutting down`);server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop('SIGTERM'));
