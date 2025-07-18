import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-menu-card',
  templateUrl: './menu-card.component.html',
  styleUrls: ['./menu-card.component.css']
})
export class MenuCardComponent implements OnInit {

  @Input() headerText: string;
  @Input() infoText: string;
  @Input() timingText: string; // For tournament timing info
  @Input() locationText: string; // For tournament location info
  @Input() iconPath: string = ''; // For icons in secondary sidebar
  @Input() url: string;
  @Input() isRip: boolean = false; // For special "RIP" styling
  @Input() sidebarStyle: boolean = false; // For sidebar styling
  @Input() secondarySidebar: boolean = false; // For secondary sidebar styling
  @Input() isDisabled: boolean = false; // For disabled styling
  @Input() disabledMessage: string = 'Currently unavailable'; // Customizable disabled message
  @Input() disabledStatusText: string = 'DISABLED'; // Customizable status text
  backgroundImage: string;
  @Output() menuCardClicked: EventEmitter<any> = new EventEmitter<any>();
  constructor(
    private router: Router,
    private firebaseStorageService: FirebaseService
  ) {
    this.headerText = '';
    this.infoText = '';
    this.timingText = '';
    this.locationText = '';
    this.url = '';
    this.backgroundImage = '';
  }

  ngOnInit(): void {
    this.getMenuCardBackgroundImage().then(url => {
      this.backgroundImage = url;
    });
  }

  onClick(): void {
    // Don't navigate if this is a RIP card or disabled
    if (this.isRip || this.isDisabled) {
      return;
    }
    
    if (this.url.startsWith('http')) {
      window.open(this.url, '_blank');
    } else if (this.url.startsWith('mailto:')) {
      window.location.href = this.url;
    } else {
      this.router.navigateByUrl(this.url);
    }
  }

  async getMenuCardBackgroundImage(): Promise<string> {
    const random = Math.floor(Math.random() * 10) + 1;
    const localStorageKey = `menuCardImage-${random}`;

    const cachedImageUrl = localStorage.getItem(localStorageKey);
    if (cachedImageUrl) {
      return cachedImageUrl;
    }

    const imageUrl = await this.firebaseStorageService.getImageUrl(`/ui/menu-cards/tile${random}.jpg`);

    localStorage.setItem(localStorageKey, imageUrl);
    return imageUrl;
  }
}
