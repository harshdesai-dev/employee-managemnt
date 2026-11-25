import {z} from 'zod';
const email=z.string().trim().email().max(255).transform(v=>v.toLowerCase());
export const loginSchema=z.object({email,password:z.string().min(1).max(128)});
export const employeeSchema=z.object({
 employee_code:z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
 full_name:z.string().trim().min(2).max(140),email,
 phone:z.string().trim().min(7).max(30).regex(/^[+()\d\s.-]+$/),
 department:z.string().trim().min(2).max(80),designation:z.string().trim().min(2).max(100),
 salary:z.coerce.number().finite().min(0).max(9999999999.99),
 joining_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 status:z.enum(['Active','On Leave','Inactive'])
});
