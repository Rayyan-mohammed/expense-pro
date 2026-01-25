export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum PaymentMode {
  ONLINE = 'ONLINE',
  CASH = 'CASH'
}

export enum MemberRole {
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
  OWNER = 'OWNER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  type: TransactionType;
  paymentMode: PaymentMode;
  comment: string;
  date: string;
  status: TransactionStatus;
  createdBy: string;
  comments: Comment[];
}

export interface AccountMember {
  userId: string;
  role: MemberRole;
}

export interface Account {
  id: string;
  name: string;
  ownerId: string;
  members: AccountMember[];
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  accounts: Account[];
  transactions: Transaction[];
  users: User[];
  currency: string;
}