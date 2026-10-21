import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root component. Authenticated pages render inside the app layout (`AuthenticatedLayoutComponent`);
 * auth pages render on their own. Each of them provides its own `<main>` landmark.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
