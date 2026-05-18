import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {
  @Input() compact = false;
  readonly year = new Date().getFullYear();
}
