
export type UtilityType = 'Luce' | 'Gas';

export interface Utility {
  id: string;
  type: UtilityType;
  provider: string;
  dateAdded: string;
  status: 'Attiva' | 'In Lavorazione' | 'Rifiutata';
  attachmentName?: string; // Name of the uploaded file
  attachmentType?: string; // MIME type (pdf/image)
  attachmentData?: string; // Base64 content for preview
}

export interface AvatarConfig {
  style: string; // e.g., 'bottts-neutral', 'avataaars', 'shapes', 'adventurer'
  seed: string;
  backgroundColor: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, this would be hashed
  email: string;
  phone: string;
  sponsorId: string | null; // Who invited them
  parentId: string | null; // Who they are placed under (Matrix structure)
  joinedAt: string;
  level: number; // Level relative to the root
  utilities: Utility[]; // Personal portfolio
  avatarConfig?: AvatarConfig; // Custom avatar settings
}

export interface MatrixNode extends User {
  children: MatrixNode[];
  totalDownline: number;
  totalUtilities: number; // Aggregated utilities in downline
  sponsorUsername: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface Stats {
  totalUsers: number;
  matrixDepth: number;
  nextEmptySpot: string;
  totalUtilities: number;
}