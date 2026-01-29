
export enum TaskCategory {
  ALL = 'All',
  INSTALL = 'Install',
  GAMES = 'Games',
  SIGNUP = 'Signup',
  OTHERS = 'Others',
  SAVE = 'Save'
}

export enum TaskStatus {
  AVAILABLE = 'available',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface Task {
  id: string;
  title: string;
  price: number;
  category: TaskCategory;
  description: string;
  imageUrl: string;
  actionText: string;
}

export interface UserTask {
  taskId: string;
  status: TaskStatus;
  submittedAt: string;
  screenshotUrl?: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  upiId: string;
  method: string;
  status: 'pending' | 'success' | 'failed';
  date: string;
}

export interface UserProfile {
  name: string;
  email: string;
  userId: string;
  avatar?: string;
}

export interface WalletState {
  pendingAmount: number;
  withdrawableAmount: number;
  history: Withdrawal[];
}
