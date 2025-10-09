import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CompetitionService } from '../services/competition.service';
import { AuthService } from '../services/auth.service';
import { CompetitionSeason, House, CompetitionEvent, PlayerCompetitionStats } from '../../models/competition';

@Component({
  selector: 'app-competition-view',
  templateUrl: './competition-view.component.html',
  styleUrls: ['./competition-view.component.css']
})
export class CompetitionViewComponent implements OnInit, OnDestroy {
  currentSeason$: Observable<CompetitionSeason | null>;
  playerStats: PlayerCompetitionStats[] = [];
  
  // Secret portal variables
  private keySequence: string = '';
  private readonly secretKeyword = 'secret';
  private keySequenceTimeout: any;
  showSecretModal = false;
  username = '';
  password = '';
  isLoading = false;

  constructor(
    private competitionService: CompetitionService,
    private authService: AuthService,
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.currentSeason$ = this.competitionService.getCurrentSeason();
  }

  ngOnInit(): void {
    this.loadPlayerStats();
  }

  ngOnDestroy(): void {
    if (this.keySequenceTimeout) {
      clearTimeout(this.keySequenceTimeout);
    }
  }

  @HostListener('window:keypress', ['$event'])
  onKeyPress(event: KeyboardEvent): void {
    // Only track if focus is not on an input element
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // Add the pressed key to the sequence
    this.keySequence += event.key.toLowerCase();

    // Clear previous timeout
    if (this.keySequenceTimeout) {
      clearTimeout(this.keySequenceTimeout);
    }

    // Set timeout to reset sequence after 2 seconds of inactivity
    this.keySequenceTimeout = setTimeout(() => {
      this.keySequence = '';
    }, 2000);

    // Check if the sequence contains the secret keyword
    if (this.keySequence.includes(this.secretKeyword)) {
      this.keySequence = '';
      this.openSecretPortal();
    }

    // Keep only the last 10 characters to prevent memory issues
    if (this.keySequence.length > 10) {
      this.keySequence = this.keySequence.slice(-10);
    }
  }

  openSecretPortal(): void {
    this.showSecretModal = true;
    this.username = '';
    this.password = '';
  }

  closeSecretModal(): void {
    this.showSecretModal = false;
    this.username = '';
    this.password = '';
  }

  submitManagerPassword(): void {
    if (!this.username || !this.password) {
      this.snackBar.open('Please enter both username and password', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoading = true;
    
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        if (response.success) {
          // Check if user has admin permissions
          if (this.authService.hasPermission('view_admin_panel' as any)) {
            this.showSecretModal = false;
            this.snackBar.open(`Welcome, ${response.user?.displayName}!`, 'Close', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.router.navigate(['/competition-admin']);
          } else {
            this.snackBar.open('You do not have permission to access the admin panel', 'Close', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            this.authService.logout(); // Log them out since they can't access admin
          }
        } else {
          this.snackBar.open(response.message || 'Login failed', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open('An error occurred during login', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Login error:', error);
      }
    });
  }

  loadPlayerStats(): void {
    this.playerStats = this.competitionService.getPlayerStats();
  }

  getHouseRanking(houses: House[]): House[] {
    return [...houses].sort((a, b) => b.points - a.points);
  }

  getRecentEvents(events: CompetitionEvent[]): CompetitionEvent[] {
    return [...events]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }

  getUpcomingEvents(events: CompetitionEvent[]): CompetitionEvent[] {
    const now = new Date();
    return [...events]
      .filter(event => new Date(event.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }

  getHouseColor(houseId: number, houses: House[]): string {
    const house = houses.find(h => h.id === houseId);
    return house?.color || '#000000';
  }
}
