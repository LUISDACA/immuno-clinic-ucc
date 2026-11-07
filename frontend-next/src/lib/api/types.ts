export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  must_change_password?: boolean;
}

export type Role = "student" | "admin" | "app_admin";
export type Gender = "male" | "female";
export type AppliesTo = "all" | "male" | "female";
export type DoseType = "standard" | "booster" | "titer";

export type VaccineStatus = "approved" | "denied" | "in_review";
export type DoseStatus = "approved" | "denied" | "in_review";
export type ReportVaccinationStatus = "approved" | "pending" | "denied" | "in_review";
export type ConversationStatus = "open" | "closed";
/** Includes FastAPI's authoritative values and legacy client values during migration. */
export type EvidenceBatchStatus =
  | "in_review"
  | "approved"
  | "denied"
  | "uploaded"
  | "under_review"
  | "reviewed"
  | "pending";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  job_title?: string | null;
  document_number?: string | null;
  student_id?: string | null;
  birth_date?: string | null;
  sex: Gender;
  phone?: string | null;
  eps_affiliation?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  program?: string | null;
  campus?: string | null;
  semester?: number | null;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  profile: Profile | null;
}

export interface DoseConfig {
  id: string;
  dose_number: number;
  label: string;
  is_required: boolean;
  applies_to: AppliesTo;
  dose_type: DoseType;
}

export interface Vaccine {
  id: string;
  name: string;
  code: string;
  base_doses: number;
  has_booster: boolean;
  has_titer: boolean;
  has_titer_value: boolean;
  is_annual: boolean;
  applies_to: AppliesTo;
  display_order: number;
  dose_configs: DoseConfig[];
}

export interface StudentDose {
  id: string;
  dose_number: number;
  applied_date: string | null;
  due_date: string | null;
  days_until_due: number | null;
  is_overdue: boolean | null;
  is_due_today: boolean | null;
  titer_value: string | null;
  status: DoseStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  dose_config: DoseConfig | null;
}

export interface StudentVaccine {
  id: string;
  vaccine_id: string;
  status: VaccineStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  vaccine: Vaccine | null;
  doses: StudentDose[];
}

export interface SchemeOverview {
  total_vaccines: number;
  approved_vaccines: number;
  pending_vaccines: number;
  denied_vaccines: number;
  in_review_vaccines: number;
  is_up_to_date: boolean;
  is_complete: boolean;
  is_certifiable: boolean;
  evaluated_on: string | null;
  scheme_version: number;
  vaccines: StudentVaccine[];
}

export interface EvidenceFile {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface EvidenceBatch {
  id: string;
  dose_id?: string | null;
  status: EvidenceBatchStatus;
  notes: string | null;
  created_at: string;
  files: EvidenceFile[];
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size?: number;
  total: number;
  pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
  /** Legacy aliases retained for older FastAPI deployments. */
  page_size?: number;
  total_pages?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  category: string | null;
  action_path: string | null;
  created_at: string;
}

export interface ConversationUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface CommunicationMessage {
  id: string;
  body: string;
  created_at: string;
  sender: ConversationUser | null;
}

export interface CommunicationThreadListItem {
  id: string;
  subject: string;
  category: string | null;
  status: ConversationStatus;
  student: ConversationUser;
  created_by: ConversationUser | null;
  recipient: ConversationUser | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  last_message: string | null;
  last_message_sender: ConversationUser | null;
}

export interface CommunicationThread extends CommunicationThreadListItem {
  messages: CommunicationMessage[];
}

export interface AdminStudentListItem extends User {
  vaccination_status: ReportVaccinationStatus;
}

export interface AdminStudentListResponse {
  items: AdminStudentListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  size?: number;
  pages?: number;
  has_next?: boolean;
  has_previous?: boolean;
}

export interface AcademicOptions {
  programs: string[];
  campuses: string[];
  semesters: number[];
}

export interface AdminStatistics {
  total_students: number;
  active_students: number;
  inactive_students: number;
  by_sex: Record<string, number>;
  by_campus: Record<string, number>;
  by_program: Record<string, number>;
  vaccination_status: { approved: number; pending: number };
  vaccine_compliance: Array<{
    vaccine_id: string;
    name: string;
    code: string;
    up_to_date: number;
    pending: number;
    denied: number;
    in_review: number;
    total: number;
  }>;
}

export interface ImportStudentRowResult {
  row: number;
  email: string | null;
  status: "created" | "skipped" | "error" | string;
  message: string;
}

export interface ImportStudentsResponse {
  total_rows: number;
  created: number;
  skipped: number;
  errors: number;
  results: ImportStudentRowResult[];
}

export interface ImportPreviewRow {
  row: number;
  email: string | null;
  name: string | null;
  predicted_status: "will_create" | "will_skip" | "error" | string;
  message: string;
}

export interface ImportPreviewResponse {
  total_rows: number;
  will_create: number;
  will_skip: number;
  errors: number;
  rows: ImportPreviewRow[];
}

export interface AuditActor {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
}

export interface AuditEntry {
  id: string;
  actor: AuditActor | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface VaccineDoseConfigInput {
  dose_number: number;
  label: string;
  is_required: boolean;
  applies_to: AppliesTo;
  dose_type: DoseType;
}

export interface VaccineCatalogItem extends Vaccine {
  is_active: boolean;
}
