import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MenuCardComponent } from '../menu-card/menu-card.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  liveVideoId: string | null = null;
  channelId = 'UCpElhVL_GGDDA8gYb7jA2Aw'; // TODO: Replace with your channel's ID
  apiKey = 'AIzaSyBb1XT-tjN-uDf6xP-hDnvJExM1_Pp0gFI'; // TODO: Replace with your YouTube Data API v3 key

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.fetchLiveStreamId(); // Restore dynamic fetching of your channel's live stream
  }

  fetchLiveStreamId() {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.channelId}&eventType=live&type=video&key=${this.apiKey}`;
    this.http.get<any>(url).subscribe(res => {
      if (res.items && res.items.length > 0) {
        this.liveVideoId = res.items[0].id.videoId;
      } else {
        this.liveVideoId = null;
      }
    }, err => {
      this.liveVideoId = null;
    });
  }
}
