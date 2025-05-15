export interface ChatMeta {
    id: string;
    created_at: string; // ISO string
    userId: string;
    userName: string;
    favorite: boolean;
}

export interface UserProfile {
  email: string;
  name: string;
  role: string;
  degree?: string;
  department?: string;
  createdAt: string;
}