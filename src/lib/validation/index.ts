import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$|^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i;

export const eventFormSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    startTime: z.string().regex(timeRegex, "Invalid start time"),
    endTime: z.string().regex(timeRegex, "Invalid end time"),
    name: z.string().min(1, "Name is required").max(200),
    registrationNumber: z.string().min(1, "Registration number is required").max(50),
    eventName: z.string().min(1, "Event / work name is required").max(300),
    location: z.string().min(1, "Location is required").max(200),
    remarks: z.string().max(2000).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    department: z.string().max(200).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    organizer: z.string().max(200).optional().nullable(),
    contactInfo: z.string().max(200).optional().nullable(),
    overrideConflicts: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Compare as minutes after normalizing in caller; basic string compare for 24h
    const toMin = (t: string) => {
      const ampm = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampm) {
        let h = parseInt(ampm[1], 10);
        const m = parseInt(ampm[2], 10);
        const p = ampm[3].toUpperCase();
        if (p === "AM" && h === 12) h = 0;
        if (p === "PM" && h !== 12) h += 12;
        return h * 60 + m;
      }
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    try {
      if (toMin(data.endTime) < toMin(data.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time must be later than start time.",
          path: ["endTime"],
        });
      }
    } catch {
      /* regex already validates */
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const loginSchema = z.object({
  userId: z.string().min(1, "Username / ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    userId: z
      .string()
      .min(3, "User ID must be at least 3 characters")
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, "User ID may only contain letters, numbers, ., _, -"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    role: z.enum(["MAIN_ADMIN", "ADMIN", "USER"]),
    email: z.string().email().optional().or(z.literal("")),
    status: z.enum(["ACTIVE", "DISABLED", "PENDING"]).default("ACTIVE"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const locationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional().nullable(),
  active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  institutionName: z.string().min(1).max(200),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  timezone: z.string().default("Asia/Kolkata"),
  defaultCalendarView: z.enum(["dayGridMonth", "timeGridWeek", "timeGridDay", "listWeek"]),
  defaultWorkingHoursStart: z.string(),
  defaultWorkingHoursEnd: z.string(),
});
