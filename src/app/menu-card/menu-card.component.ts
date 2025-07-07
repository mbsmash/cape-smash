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
  @Input() url: string;
  @Input() isRip: boolean = false; // For special "RIP" styling
  @Input() sidebarStyle: boolean = false; // For sidebar styling
  backgroundImage: string;
  @Output() menuCardClicked: EventEmitter<any> = new EventEmitter<any>();
  constructor(
    private router: Router,
    private firebaseStorageService: FirebaseService
  ) {
    this.headerText = '';
    this.infoText = '';
    this.url = '';
    this.backgroundImage = '';
  }

  ngOnInit(): void {
    this.getMenuCardBackgroundImage().then(url => {
      this.backgroundImage = url;
    });
  }

  onClick(): void {
    // Don't navigate if this is a RIP card
    if (this.isRip) {
      return;
    }
    
    if (this.url.startsWith('http')) {
      window.open(this.url, '_blank');
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
