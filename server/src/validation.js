import { z } from 'zod';

const email = z.string().trim().email().max(255).transform((value) => value.toLowerCase());
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const realDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
};

export const employeeSchema = z.object({
  employee_code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Employee code contains invalid characters.'),
  full_name: z.string().trim().min(2).max(140)
    .refine((value) => /\p{L}/u.test(value) && !/[\u0000-\u001f\u007f]/.test(value), 'Enter a valid employee name.'), email,
  phone: z.string().trim().min(7).max(30).regex(/^[+()\d\s.-]+$/),
  department: z.string().trim().min(2).max(80), designation: z.string().trim().min(2).max(100),
  salary: z.preprocess((value) => typeof value === 'string' && value.trim() === '' ? Number.NaN : typeof value === 'string' ? Number(value) : value,
    z.number().min(0).max(9999999999.99))
    .refine((value) => Number.isInteger(value * 100), 'Salary can have at most two decimal places.'),
  joining_date: z.string().refine(realDate, 'Joining date must be a real date in YYYY-MM-DD format.'),
  status: z.enum(['Active', 'On Leave', 'Inactive']),
});
