import { Component, OnInit, HostListener, OnDestroy, AfterViewInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CompetitionService } from '../services/competition.service';
import { AuthService } from '../services/auth.service';
import { FirebaseService } from '../services/firebase.service';
import { CompetitionSeason, House, CompetitionEvent, PlayerCompetitionStats } from '../../models/competition';

export interface PollOption {
  id: string;
  name: string;
  description?: string;
  votes: number;
  emblem?: string;
  color?: string;
}

export interface HouseNamePoll {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  options: PollOption[];
  maxSelections: number;
  endDate?: Date;
  userVotes: string[];
}

@Component({
  selector: 'app-competition-view',
  templateUrl: './competition-view.component.html',
  styleUrls: ['./competition-view.component.css']
})
export class CompetitionViewComponent implements OnInit, OnDestroy, AfterViewInit {
  currentSeason$: Observable<CompetitionSeason | null>;
  playerStats: PlayerCompetitionStats[] = [];
  
  // Poll properties
  houseNamePoll: HouseNamePoll | null = null;
  showPollResults = false;
  hasVoted = false;
  userSessionId: string = '';
  pollCountdown: string = '';
  private countdownInterval: any;
  private pollSubscription: Subscription | null = null;
  
  // Secret portal variables
  private keySequence: string = '';
  private readonly secretKeyword = 'secret';
  private keySequenceTimeout: any;
  showSecretModal = false;
  username = '';
  password = '';
  isLoading = false;

  // Additional properties for better analytics
  totalUniqueVoters = 0;

  constructor(
    private competitionService: CompetitionService,
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.currentSeason$ = this.competitionService.getCurrentSeason();
  }

  ngOnInit(): void {
    this.loadPlayerStats();
    this.initializeUserSession();
    this.loadHouseNamePoll();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.keySequenceTimeout) {
      clearTimeout(this.keySequenceTimeout);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
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

  // Poll Methods
  private initializeUserSession() {
    // Try to get existing user ID from localStorage
    let userId = localStorage.getItem('pollUserId');
    
    if (!userId) {
      // Create a more persistent user ID that combines device fingerprint with timestamp
      const deviceInfo = this.getDeviceFingerprint();
      const timestamp = Date.now();
      userId = `user_${deviceInfo}_${timestamp}`;
      localStorage.setItem('pollUserId', userId);
    }
    
    this.userSessionId = userId;
  }

  private getDeviceFingerprint(): string {
    // Create a simple device fingerprint based on available browser/device info
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Device fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Create a simple hash of the fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private async loadHouseNamePoll() {
    try {
      // Try to load poll from Firebase first
      const pollData = await this.firebaseService.getPoll('house-names-2025');
      
      if (pollData) {
        // Convert Firebase data structure to our poll format
        this.houseNamePoll = {
          id: pollData.id,
          title: pollData.title,
          description: pollData.description,
          isActive: pollData.isActive,
          maxSelections: pollData.maxSelections,
          endDate: pollData.endDate ? new Date(pollData.endDate) : undefined,
          userVotes: [],
          options: Object.keys(pollData.options || {}).map(optionId => ({
            id: optionId,
            name: pollData.options[optionId].name,
            votes: pollData.options[optionId].votes || 0,
            emblem: pollData.options[optionId].emblem,
            color: pollData.options[optionId].color
          }))
        };
      } else {
        // Create default poll if none exists
        await this.createDefaultPoll();
      }
      
      // Subscribe to real-time updates
      this.subscribeToPollChanges();
      
      // Check if user has already voted
      await this.checkUserVoteStatus();
      
      // Load unique voter count
      this.loadUniqueVoterCount();
      
    } catch (error: any) {
      console.error('Error loading poll from Firebase:', error);
      
      // Show user-friendly error message
      this.snackBar.open('Unable to connect to voting system. Please try again later.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      
      // Fallback to localStorage for offline functionality, but disable voting
      this.loadPollFromLocalStorage();
      if (this.houseNamePoll) {
        this.houseNamePoll.isActive = false; // Disable voting when offline
      }
    }
  }

  private ensureAllHouseOptions() {
    if (!this.houseNamePoll) return;
    
    const expectedOptions = [
      { id: 'golden-geese', name: 'Golden Geese', emblem: '🪿', color: '#f1c40f' },
      { id: 'crimson-kitties', name: 'Crimson Kitties', emblem: '🐱', color: '#e74c3c' },
      { id: 'purple-porcupines', name: 'Purple Porcupines', emblem: '🦔', color: '#9b59b6' },
      { id: 'rainbow-ravens', name: 'Rainbow Ravens', emblem: '🐦‍⬛', color: '#3498db' },
      { id: 'teal-toads', name: 'Teal Toads', emblem: '🐸', color: '#16a085' },
      { id: 'fuchsia-frogs', name: 'Fuchsia Frogs', emblem: '🐸', color: '#e91e63' },
      { id: 'orange-chickens', name: 'Orange Chickens', emblem: '🐔', color: '#f39c12' },
      { id: 'hazel-hedgehogs', name: 'Hazel Hedgehogs', emblem: '🦔', color: '#8B4513' },
      { id: 'camo-cows', name: 'Camo Cows', emblem: '🐄', color: '#556B2F' }
    ];

    // Add any missing options
    for (const expectedOption of expectedOptions) {
      const existingOption = this.houseNamePoll.options.find(opt => opt.id === expectedOption.id);
      if (!existingOption) {
        this.houseNamePoll.options.push({
          id: expectedOption.id,
          name: expectedOption.name,
          votes: 0,
          emblem: expectedOption.emblem,
          color: expectedOption.color
        });
      }
    }

    // Save the updated poll
    this.savePoll();
  }

  private async createDefaultPoll() {
    this.houseNamePoll = {
      id: 'house-names-2025',
      title: 'Choose the Three House Names for Season 6!',
      description: 'Vote for your top 3 favorite house names. The three options with the most votes will become our official houses.',
      isActive: true,
      maxSelections: 3,
      endDate: new Date('2025-10-31T23:59:59'),
      userVotes: [],
      options: [
        {
          id: 'golden-geese',
          name: 'Golden Geese',
          votes: 0,
          emblem: '🪿',
          color: '#f1c40f'
        },
        {
          id: 'crimson-kitties',
          name: 'Crimson Kitties',
          votes: 0,
          emblem: '🐱',
          color: '#e74c3c'
        },
        {
          id: 'purple-porcupines',
          name: 'Purple Porcupines',
          votes: 0,
          emblem: '🦔',
          color: '#9b59b6'
        },
        {
          id: 'rainbow-ravens',
          name: 'Rainbow Ravens',
          votes: 0,
          emblem: '🐦‍⬛',
          color: '#3498db'
        },
        {
          id: 'teal-toads',
          name: 'Teal Toads',
          votes: 0,
          emblem: '🐸',
          color: '#16a085'
        },
        {
          id: 'fuchsia-frogs',
          name: 'Fuchsia Frogs',
          votes: 0,
          emblem: '🐸',
          color: '#e91e63'
        },
        {
          id: 'orange-chickens',
          name: 'Orange Chickens',
          votes: 0,
          emblem: '🐔',
          color: '#f39c12'
        },
        {
          id: 'hazel-hedgehogs',
          name: 'Hazel Hedgehogs',
          votes: 0,
          emblem: '🦔',
          color: '#8B4513'
        },
        {
          id: 'camo-cows',
          name: 'Camo Cows',
          votes: 0,
          emblem: '🐄',
          color: '#556B2F'
        }
      ]
    };
    await this.savePoll();
  }

  private async checkUserVoteStatus() {
    if (this.houseNamePoll) {
      try {
        const userVotes = await this.firebaseService.getUserVotes(this.houseNamePoll.id, this.userSessionId);
        this.hasVoted = !!userVotes;
        if (userVotes) {
          this.houseNamePoll.userVotes = userVotes;
        } else {
          // If no votes in Firebase, clear any local votes to prevent inconsistency
          this.houseNamePoll.userVotes = [];
        }
      } catch (error) {
        console.error('Error checking vote status:', error);
        // On error, default to not voted state to be safe
        this.hasVoted = false;
        this.houseNamePoll.userVotes = [];
      }
    }
  }

  onPollOptionToggle(optionId: string) {
    if (!this.houseNamePoll || this.hasVoted || !this.houseNamePoll.isActive) return;

    const currentVotes = [...this.houseNamePoll.userVotes];
    const optionIndex = currentVotes.indexOf(optionId);

    if (optionIndex > -1) {
      currentVotes.splice(optionIndex, 1);
    } else if (currentVotes.length < this.houseNamePoll.maxSelections) {
      currentVotes.push(optionId);
    }

    this.houseNamePoll.userVotes = currentVotes;
  }  async submitPollVotes() {
    if (!this.houseNamePoll || this.hasVoted || this.houseNamePoll.userVotes.length === 0) return;

    try {
      // Submit votes to Firebase
      await this.firebaseService.submitVote(
        this.houseNamePoll.id, 
        this.userSessionId, 
        this.houseNamePoll.userVotes
      );

      // Update local state
      this.hasVoted = true;
      this.showPollResults = true;

      // Refresh unique voter count
      this.loadUniqueVoterCount();

      // Also save to localStorage as backup
      localStorage.setItem(
        `poll_votes_${this.houseNamePoll.id}_${this.userSessionId}`, 
        JSON.stringify(this.houseNamePoll.userVotes)
      );

      // Show success message
      this.snackBar.open('Your votes have been submitted successfully!', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });

    } catch (error: any) {
      console.error('Error submitting votes:', error);
      
      // Check if the error is due to already voting
      if (error.message && error.message.includes('already voted')) {
        this.hasVoted = true;
        this.snackBar.open('You have already voted in this poll!', 'Close', {
          duration: 5000,
          panelClass: ['warning-snackbar']
        });
        return;
      }
      
      // For other errors, show error message but don't fallback to local voting
      // This ensures vote integrity
      this.snackBar.open('Failed to submit votes. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    }
  }

  togglePollResults() {
    this.showPollResults = !this.showPollResults;
  }

  getPollResults(): PollOption[] {
    if (!this.houseNamePoll) return [];
    return [...this.houseNamePoll.options].sort((a, b) => b.votes - a.votes);
  }

  getTotalVotes(): number {
    if (!this.houseNamePoll) return 0;
    return this.houseNamePoll.options.reduce((total, option) => total + option.votes, 0);
  }

  getVotePercentage(option: PollOption): number {
    const total = this.getTotalVotes();
    return total > 0 ? (option.votes / total) * 100 : 0;
  }

  isPollActive(): boolean {
    if (!this.houseNamePoll) return false;
    if (!this.houseNamePoll.isActive) return false;
    if (this.houseNamePoll.endDate && new Date() > new Date(this.houseNamePoll.endDate)) {
      return false;
    }
    return true;
  }

  private async savePoll() {
    if (this.houseNamePoll) {
      try {
        // Convert poll data to Firebase format
        const firebasePollData: any = {
          id: this.houseNamePoll.id,
          title: this.houseNamePoll.title,
          description: this.houseNamePoll.description,
          isActive: this.houseNamePoll.isActive,
          maxSelections: this.houseNamePoll.maxSelections,
          endDate: this.houseNamePoll.endDate ? 
            (this.houseNamePoll.endDate instanceof Date ? 
              this.houseNamePoll.endDate.toISOString() : 
              this.houseNamePoll.endDate) : null,
          options: {}
        };

        // Convert options array to object for Firebase
        this.houseNamePoll.options.forEach(option => {
          firebasePollData.options[option.id] = {
            name: option.name,
            votes: option.votes || 0,
            emblem: option.emblem,
            color: option.color
          };
        });

        await this.firebaseService.savePoll(this.houseNamePoll.id, firebasePollData);
        
        // Also save to localStorage as backup
        localStorage.setItem('houseNamePoll', JSON.stringify(this.houseNamePoll));
        
      } catch (error) {
        console.error('Error saving poll to Firebase:', error);
        // Fallback to localStorage only
        localStorage.setItem('houseNamePoll', JSON.stringify(this.houseNamePoll));
      }
    }
  }

  startCountdown() {
    this.updateCountdown();
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown() {
    if (!this.houseNamePoll?.endDate) {
      this.pollCountdown = '';
      return;
    }

    const now = new Date().getTime();
    const endTime = new Date(this.houseNamePoll.endDate).getTime();
    const timeLeft = endTime - now;

    if (timeLeft <= 0) {
      this.pollCountdown = 'Voting has ended';
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      return;
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    if (days > 0) {
      this.pollCountdown = `${days}d ${hours}h ${minutes}m remaining`;
    } else if (hours > 0) {
      this.pollCountdown = `${hours}h ${minutes}m ${seconds}s remaining`;
    } else {
      this.pollCountdown = `${minutes}m ${seconds}s remaining`;
    }
  }

  getOptionName(optionId: string): string {
    if (!this.houseNamePoll) return '';
    const option = this.houseNamePoll.options.find(opt => opt.id === optionId);
    return option ? option.name : '';
  }

  getOptionEmblem(optionId: string): string {
    if (!this.houseNamePoll) return '';
    const option = this.houseNamePoll.options.find(opt => opt.id === optionId);
    return option ? option.emblem || '' : '';
  }

  private subscribeToPollChanges() {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
    
    this.pollSubscription = this.firebaseService.listenToPollChanges('house-names-2025')
      .subscribe({
        next: (pollData) => {
          if (pollData && this.houseNamePoll) {
            // Update vote counts from Firebase
            this.houseNamePoll.options.forEach(option => {
              if (pollData.options && pollData.options[option.id]) {
                option.votes = pollData.options[option.id].votes || 0;
              }
            });
            
            // Refresh unique voter count
            this.loadUniqueVoterCount();
          }
        },
        error: (error) => {
          console.error('Error listening to poll changes:', error);
        }
      });
  }

  private loadPollFromLocalStorage() {
    const savedPoll = localStorage.getItem('houseNamePoll');
    if (savedPoll) {
      this.houseNamePoll = JSON.parse(savedPoll);
      this.ensureAllHouseOptions();
    } else {
      this.createDefaultPoll();
    }
    this.checkUserVoteStatus();
  }

  private async loadUniqueVoterCount() {
    if (this.houseNamePoll) {
      try {
        this.totalUniqueVoters = await this.firebaseService.getTotalUniqueVoters(this.houseNamePoll.id);
      } catch (error) {
        console.error('Error loading unique voter count:', error);
      }
    }
  }

  // Admin method to reset poll (can be called from console for testing)
  async resetPoll() {
    if (this.houseNamePoll) {
      try {
        // Reset all vote counts to 0
        this.houseNamePoll.options.forEach(option => {
          option.votes = 0;
        });

        // Clear user votes
        this.houseNamePoll.userVotes = [];
        this.hasVoted = false;
        this.showPollResults = false;
        this.totalUniqueVoters = 0;

        // Save the reset poll to Firebase
        await this.savePoll();

        // Clear all votes from Firebase
        await this.firebaseService.clearAllVotes(this.houseNamePoll.id);

        // Clear local storage
        localStorage.removeItem(`poll_votes_${this.houseNamePoll.id}_${this.userSessionId}`);
        localStorage.removeItem('houseNamePoll');

        console.log('Poll has been reset successfully');
        
        this.snackBar.open('Poll has been reset successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });

      } catch (error) {
        console.error('Error resetting poll:', error);
        this.snackBar.open('Error resetting poll', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    }
  }

  // Make component accessible from console for admin tasks
  ngAfterViewInit() {
    // Make component accessible from browser console for admin tasks
    (window as any).pollAdmin = this;
  }
}
