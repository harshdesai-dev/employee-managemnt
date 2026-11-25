import {pool} from '../db.js';
const rows=[
['EMP-001','Aarav Mehta','aarav.mehta@example.com','+91 98765 10001','Engineering','Senior Software Engineer',1250000,'2023-04-12','Active'],
['EMP-002','Ananya Iyer','ananya.iyer@example.com','+91 98765 10002','Design','Product Designer',980000,'2022-08-03','Active'],
['EMP-003','Kabir Shah','kabir.shah@example.com','+91 98765 10003','Marketing','Growth Marketing Lead',1100000,'2024-01-15','On Leave'],
['EMP-004','Mira Das','mira.das@example.com','+91 98765 10004','Human Resources','People Operations Manager',900000,'2021-11-22','Active'],
['EMP-005','Rohan Kulkarni','rohan.k@example.com','+91 98765 10005','Finance','Financial Analyst',760000,'2024-06-10','Inactive']];
try{for(const r of rows)await pool.query(`INSERT INTO employees(employee_code,full_name,email,phone,department,designation,salary,joining_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,r);console.log('Sample employees inserted (existing rows preserved).');}
catch(e){console.error(e.message);process.exitCode=1;}finally{await pool.end();}
