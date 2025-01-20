import { Component, Input, OnInit } from '@angular/core';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-banner',
  templateUrl: './banner.component.html',
  styleUrls: ['./banner.component.css']
})
export class BannerComponent implements OnInit {

  @Input() subject: string;
  @Input() info: string;
  @Input() link: string;
  @Input() linkText: string = '';
  bannerIcon: string = '';

  constructor(private firebaseStorageService: FirebaseService) {
    this.subject = '';
    this.info = '';
    this.link = '';
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
