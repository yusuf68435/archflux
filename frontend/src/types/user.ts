export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
  locale: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  credits: number;
  createdAt: string;
  updatedAt: string;
}
