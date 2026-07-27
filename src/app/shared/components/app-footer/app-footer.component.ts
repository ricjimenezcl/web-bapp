import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, TPipe],
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {
  @Input() compact = false;
  readonly year = new Date().getFullYear();
}
