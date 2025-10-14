import { z } from "zod";

export const connectionConfigSchema = z.object({
  server: z.string().min(1),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  port: z.number().int().positive().optional().default(1433),
  options: z
    .object({
      encrypt: z.boolean().optional(),
      trustServerCertificate: z.boolean().optional(),
    })
    .optional(),
});

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
