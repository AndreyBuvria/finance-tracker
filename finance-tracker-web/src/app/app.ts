import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component. The app shell (navigation, top bar) is a later task. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<main><router-outlet /></main>`,
})
export class App {}
