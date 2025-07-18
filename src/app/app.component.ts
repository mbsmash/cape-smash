import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'cape-smash';
  sidebarHiddenOnMobile = true;

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (event.urlAfterRedirects.includes('stage-list-bans-full')) {
          document.body.classList.add('hide-top-nav');
        } else {
          document.body.classList.remove('hide-top-nav');
        }
      }
    });
  }

  toggleSidebar() {
    this.sidebarHiddenOnMobile = !this.sidebarHiddenOnMobile;
  }

  closeSidebarOnMobile() {
    if (window.innerWidth <= 768 && !this.sidebarHiddenOnMobile) {
      this.sidebarHiddenOnMobile = true;
    }
  }
}
