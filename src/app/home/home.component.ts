import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface HomeMenuOption {
  title: string;
  description: string;
  url: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  liveVideoId: string | null = null;
  channelId = 'UCpElhVL_GGDDA8gYb7jA2Aw';
  apiKey = 'AIzaSyBb1XT-tjN-uDf6xP-hDnvJExM1_Pp0gFI';

  homeMenuOptions: HomeMenuOption[] = [
    {
      title: 'Stage List and Bans Tool',
      description: 'Quick access to the unified ruleset used at SEMO Smash events.',
      url: 'stage-list-bans-full'
    },
    {
      title: 'Tournaments',
      description: 'Current and recurring tournament information and links.',
      url: 'tournaments'
    },
    {
      title: 'Streams, VODs & Content',
      description: 'Watch live streams, VODs, and community content.',
      url: 'streaming'
    },
    {
      title: 'Contact',
      description: 'Get in touch with the SEMO Smash organizers.',
      url: 'mailto:mbsmashacct@gmail.com'
    },
    {
      title: 'Source Code',
      description: 'See the project repository and open-source code.',
      url: 'https://github.com/mbsmash/cape-smash'
    }
  ];

  activeCardIndex = 0;
  private touchStartX = 0;

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.fetchLiveStreamId();
  }

  fetchLiveStreamId() {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.channelId}&eventType=live&type=video&key=${this.apiKey}`;
    this.http.get<any>(url).subscribe(res => {
      this.liveVideoId = res.items && res.items.length > 0 ? res.items[0].id.videoId : null;
    }, () => {
      this.liveVideoId = null;
    });
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    const delta = event.changedTouches[0].screenX - this.touchStartX;
    if (Math.abs(delta) < 35) {
      return;
    }

    if (delta < 0) {
      this.nextCard();
    } else {
      this.previousCard();
    }
  }

  nextCard(): void {
    this.activeCardIndex = (this.activeCardIndex + 1) % this.homeMenuOptions.length;
  }

  previousCard(): void {
    this.activeCardIndex = (this.activeCardIndex - 1 + this.homeMenuOptions.length) % this.homeMenuOptions.length;
  }

  openCurrentCard(): void {
    this.openOption(this.homeMenuOptions[this.activeCardIndex].url);
  }

  openOption(url: string): void {
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else if (url.startsWith('mailto:')) {
      window.location.href = url;
    } else {
      this.router.navigateByUrl(url);
    }
  }
}
