export type Role = "MAIN_ADMIN" | "ADMIN" | "USER";

export type UserStatus = "ACTIVE" | "DISABLED" | "PENDING";

export type TimeSlotCategory = "MORNING" | "EVENING" | "HALF_DAY_MORNING" | "HALF_DAY_EVENING" | "FULL_DAY";

export type DayCategory = "MORNING" | "EVENING" | "FULL_DAY" | "MULTI_SLOT" | "CUSTOM";

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string; // HH:mm 24h
  endTime: string;
  category: TimeSlotCategory;
  displayOrder: number;
  active: boolean;
}

export interface Profile {
  id: string;
  name: string;
  userId: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  forcePasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface EventCategory {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
}

export interface ScheduleEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  name: string;
  registrationNumber: string;
  eventName: string;
  location: string;
  remarks: string | null;
  description: string | null;
  department: string | null;
  categoryId: string | null;
  organizer: string | null;
  contactInfo: string | null;
  dayCategory: DayCategory;
  affectedSlots: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  conflictFlags?: ConflictFlag[];
}

export interface ConflictFlag {
  type: "PERSON" | "LOCATION" | "EXACT";
  message: string;
  conflictingEventId: string;
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: ConflictFlag[];
}

export interface ClassificationResult {
  dayCategory: DayCategory;
  affectedSlots: TimeSlot[];
  halfDay: "MORNING" | "EVENING" | "FULL_DAY" | "NONE";
  categoryLabel: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface SystemSettings {
  institutionName: string;
  logoUrl: string | null;
  timezone: string;
  defaultCalendarView: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
  defaultWorkingHoursStart: string;
  defaultWorkingHoursEnd: string;
}

export interface Permission {
  id: string;
  role: Role;
  permission: string;
  enabled: boolean;
}

export type PermissionKey =
  | "events:create"
  | "events:read"
  | "events:update"
  | "events:delete"
  | "events:update_own"
  | "events:delete_own"
  | "events:export"
  | "events:import"
  | "events:bulk"
  | "users:manage"
  | "settings:manage"
  | "audit:read"
  | "conflicts:override"
  | "locations:manage"
  | "categories:manage"
  | "timeslots:manage"
  | "reports:read";

export interface EventFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  date?: string;
  timeSlotId?: string;
  dayCategory?: DayCategory | "HALF_DAY_MORNING" | "HALF_DAY_EVENING";
  name?: string;
  registrationNumber?: string;
  location?: string;
  eventName?: string;
  categoryId?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** When false, skips exact count query (faster for calendar range loads). */
  countTotal?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Validated row ready for Excel import commit (not yet persisted). */
export interface ImportRow {
  rowNumber: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  name: string;
  registrationNumber: string;
  eventName: string;
  location: string;
  remarks: string | null;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportPreviewResult {
  valid: ImportRow[];
  errors: ImportError[];
  preview: ImportRow[];
}

export interface DashboardStats {
  todayTotal: number;
  todayMorning: number;
  todayEvening: number;
  todayFullDay: number;
  upcoming: number;
  totalEvents: number;
  locationsInUse: number;
  conflicts: number;
}

export interface SessionUser {
  id: string;
  email: string | null;
  name: string;
  userId: string;
  role: Role;
  status: UserStatus;
  forcePasswordChange: boolean;
}
