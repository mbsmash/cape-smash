import { Component, Input, OnInit } from '@angular/core';
import { FirebaseStorageService } from '../services/firebase-storage.service';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.css']
})
export class BannerComponent implements OnInit {

  @Input() subject: string;
  @Input() info: string;
  bannerIcon: string = '';

  constructor(private firebaseStorageService: FirebaseStorageService) {
    this.subject = '';
    this.info = '';
  }

  ngOnInit(): void {
    this.getBannerIcon().then(url => {
      this.bannerIcon = url;
      });
  }

  getBannerIcon(): Promise<string> {
    return this.firebaseStorageService.getImageUrl(`Smash_Ball.png`);
  }

}
