import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  returnUrl = '/';
  testCredentials: { role: string, username: string, password: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    // Get return URL from query params
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Get test credentials for development
    this.testCredentials = this.authService.getTestCredentials();
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response.success) {
            this.snackBar.open(`Welcome back, ${response.user?.displayName}!`, 'Close', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.router.navigate([this.returnUrl]);
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
  }

  quickLogin(username: string): void {
    this.isLoading = true;
    
    this.authService.quickLogin(username).subscribe({
      next: (response) => {
        this.isLoading = false;
        
        if (response.success) {
          this.snackBar.open(`Quick login as ${response.user?.displayName}`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.router.navigate([this.returnUrl]);
        } else {
          this.snackBar.open(response.message || 'Quick login failed', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.snackBar.open('An error occurred during quick login', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Quick login error:', error);
      }
    });
  }

  fillCredentials(username: string, password: string): void {
    this.loginForm.patchValue({
      username: username,
      password: password
    });
  }

  getRoleIcon(role: string): string {
    const iconMap: { [key: string]: string } = {
      'Admin': 'admin_panel_settings',
      'Manager': 'manage_accounts',
      'TO': 'event',
      'Player (Edelgard)': 'psychology',
      'Player (Dimitri)': 'shield',
      'Player (Claude)': 'flaky',
      'Viewer': 'visibility'
    };
    return iconMap[role] || 'person';
  }
}
