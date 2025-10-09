export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TO = 'to', // Tournament Organizer
  PLAYER = 'player',
  VIEWER = 'viewer'
}

export enum Permission {
  // Competition permissions
  VIEW_COMPETITION = 'view_competition',
  MANAGE_COMPETITION = 'manage_competition',
  ASSIGN_PLAYERS = 'assign_players',
  MANAGE_EVENTS = 'manage_events',
  EDIT_RULES = 'edit_rules',
  
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  VIEW_ADMIN_PANEL = 'view_admin_panel',
  MANAGE_TOURNAMENTS = 'manage_tournaments',
  
  // Player permissions
  VIEW_PLAYER_STATS = 'view_player_stats',
  EDIT_PLAYER_PROFILE = 'edit_player_profile'
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}
