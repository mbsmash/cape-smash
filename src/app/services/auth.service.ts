import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { User, UserRole, Permission, LoginCredentials, AuthResponse } from '../../models/user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Test users for development
  private testUsers: User[] = [
    {
      id: 1,
      username: 'admin',
      displayName: 'System Administrator',
      email: 'admin@capesmash.com',
      role: UserRole.ADMIN,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.MANAGE_COMPETITION,
        Permission.ASSIGN_PLAYERS,
        Permission.MANAGE_EVENTS,
        Permission.EDIT_RULES,
        Permission.MANAGE_USERS,
        Permission.VIEW_ADMIN_PANEL,
        Permission.MANAGE_TOURNAMENTS,
        Permission.VIEW_PLAYER_STATS,
        Permission.EDIT_PLAYER_PROFILE
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 2,
      username: 'manager',
      displayName: 'Competition Manager',
      email: 'manager@capesmash.com',
      role: UserRole.MANAGER,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.MANAGE_COMPETITION,
        Permission.ASSIGN_PLAYERS,
        Permission.MANAGE_EVENTS,
        Permission.EDIT_RULES,
        Permission.VIEW_ADMIN_PANEL,
        Permission.VIEW_PLAYER_STATS
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 3,
      username: 'to1',
      displayName: 'Tournament Organizer Alpha',
      email: 'to1@capesmash.com',
      role: UserRole.TO,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.ASSIGN_PLAYERS,
        Permission.MANAGE_EVENTS,
        Permission.VIEW_PLAYER_STATS
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 4,
      username: 'edelgard',
      displayName: 'Edelgard von Hresvelg',
      email: 'edelgard@blackeagles.com',
      role: UserRole.PLAYER,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.VIEW_PLAYER_STATS,
        Permission.EDIT_PLAYER_PROFILE
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 5,
      username: 'dimitri',
      displayName: 'Dimitri Alexandre Blaiddyd',
      email: 'dimitri@bluelions.com',
      role: UserRole.PLAYER,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.VIEW_PLAYER_STATS,
        Permission.EDIT_PLAYER_PROFILE
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 6,
      username: 'claude',
      displayName: 'Claude von Riegan',
      email: 'claude@goldendeer.com',
      role: UserRole.PLAYER,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.VIEW_PLAYER_STATS,
        Permission.EDIT_PLAYER_PROFILE
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    },
    {
      id: 7,
      username: 'viewer',
      displayName: 'Community Viewer',
      email: 'viewer@capesmash.com',
      role: UserRole.VIEWER,
      permissions: [
        Permission.VIEW_COMPETITION,
        Permission.VIEW_PLAYER_STATS
      ],
      isActive: true,
      createdAt: new Date('2024-01-01'),
      lastLogin: new Date()
    }
  ];

  // Test passwords (in real app, these would be hashed)
  private testPasswords: { [username: string]: string } = {
    'admin': 'admin123',
    'manager': 'manager123',
    'to1': 'to123',
    'edelgard': 'blackeagle',
    'dimitri': 'bluelion',
    'claude': 'goldendeer',
    'viewer': 'viewer123'
  };

  constructor() {
    // Check for stored user session
    this.loadStoredUser();
  }

  /**
   * Authenticate user with credentials
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return of(null).pipe(
      delay(500), // Simulate network delay
      map(() => {
        const user = this.testUsers.find(u => u.username === credentials.username);
        
        if (!user) {
          return {
            success: false,
            message: 'User not found'
          };
        }

        if (!user.isActive) {
          return {
            success: false,
            message: 'Account is disabled'
          };
        }

        if (this.testPasswords[credentials.username] !== credentials.password) {
          return {
            success: false,
            message: 'Invalid password'
          };
        }

        // Update last login
        user.lastLogin = new Date();
        
        // Store user session
        this.setCurrentUser(user);
        
        return {
          success: true,
          user: user,
          token: this.generateMockToken(user),
          message: 'Login successful'
        };
      })
    );
  }

  /**
   * Log out current user
   */
  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: Permission): boolean {
    const user = this.getCurrentUser();
    return user?.permissions.includes(permission) || false;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  }

  /**
   * Get all test users (for admin panel)
   */
  getAllUsers(): Observable<User[]> {
    return of(this.testUsers).pipe(delay(200));
  }

  /**
   * Update user (for admin panel)
   */
  updateUser(user: User): Observable<User> {
    const index = this.testUsers.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.testUsers[index] = { ...user };
      
      // If updating current user, update the subject
      if (this.getCurrentUser()?.id === user.id) {
        this.setCurrentUser(user);
      }
    }
    return of(user).pipe(delay(200));
  }

  /**
   * Quick login for testing (bypasses password)
   */
  quickLogin(username: string): Observable<AuthResponse> {
    const user = this.testUsers.find(u => u.username === username);
    
    if (user && user.isActive) {
      user.lastLogin = new Date();
      this.setCurrentUser(user);
      
      return of({
        success: true,
        user: user,
        token: this.generateMockToken(user),
        message: 'Quick login successful'
      });
    }
    
    return of({
      success: false,
      message: 'User not found or inactive'
    });
  }

  /**
   * Get test credentials for development
   */
  getTestCredentials(): { role: string, username: string, password: string }[] {
    return [
      { role: 'Admin', username: 'admin', password: 'admin123' },
      { role: 'Manager', username: 'manager', password: 'manager123' },
      { role: 'TO', username: 'to1', password: 'to123' },
      { role: 'Player (Edelgard)', username: 'edelgard', password: 'blackeagle' },
      { role: 'Player (Dimitri)', username: 'dimitri', password: 'bluelion' },
      { role: 'Player (Claude)', username: 'claude', password: 'goldendeer' },
      { role: 'Viewer', username: 'viewer', password: 'viewer123' }
    ];
  }

  private setCurrentUser(user: User): void {
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('authToken', this.generateMockToken(user));
  }

  private loadStoredUser(): void {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.error('Error loading stored user:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
      }
    }
  }

  private generateMockToken(user: User): string {
    // Simple mock token for development
    return btoa(JSON.stringify({
      userId: user.id,
      username: user.username,
      role: user.role,
      timestamp: Date.now()
    }));
  }
}
