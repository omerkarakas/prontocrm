export type Role = "admin" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  city: string;
  tags: string[];
  notes: string;
  source: string;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
  // agregasyonlar
  lastConversationAt: string | null;
  lastConversationSubject: string | null;
  lastConversationUser: string | null;
  conversationCount: number;
  eventNames: string | null;
}

export interface PersonInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  city?: string;
  tags?: string[] | string;
  notes?: string;
  source?: string;
  ownerId?: string | null;
}

export interface Conversation {
  id: string;
  personId: string;
  userId: string | null;
  userName: string | null;
  date: string;
  subject: string;
  note: string;
  createdAt: string;
}

export type EventStatus = "planned" | "ongoing" | "completed" | "cancelled";
export type ParticipantStatus = "registered" | "attended" | "cancelled" | "waitlist";

export interface CrmEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
  status: EventStatus;
  capacity: number | null;
  createdAt: string;
  participantCount?: number;
  attendedCount?: number;
}

export interface Participant extends Partial<Person> {
  personId: string;
  status: ParticipantStatus;
  registeredAt: string;
}

export interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  entity: string;
  entityId: string | null;
  action: string;
  summary: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: number | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export type FilterOp =
  | "contains"
  | "equals"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty"
  | "before"
  | "after"
  | "onOrAfter"
  | "onOrBefore"
  | "lastDays";

export interface FilterRule {
  id: string;
  field: string;
  op: FilterOp;
  value?: string;
}

export type SortState = {
  key: string;
  dir: "asc" | "desc";
} | null;
