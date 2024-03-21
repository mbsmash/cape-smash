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
    if (this.url.startsWith('http')) {
      window.open(this.url, '_blank');
    } else {
      this.router.navigateByUrl(this.url);
    }
  }

  async getMenuCardBackgroundImage(): Promise<string> {
    const random = Math.floor(Math.random() * 10) + 1;
    return await this.firebaseStorageService.getImageUrl(`/ui/menu-cards/tile${random}.jpg`);
  }
}
