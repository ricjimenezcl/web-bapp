import { Component, ElementRef, HostListener, OnInit, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Message {
  text: string;
  type: 'msg-bot' | 'msg-user';
}

@Component({
  selector: 'app-bappie-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bappie-chatbot.component.html',
  styleUrl: './bappie-chatbot.component.scss'
})
export class BappieChatbotComponent implements OnInit {
  private http = inject(HttpClient);
  @ViewChild('chatBody') chatBody!: ElementRef;
  
  isOpen = signal(false);
  isProcessing = signal(false);
  isTyping = signal(false);
  isGreeting = signal(false);
  showTooltip = signal(true);
  hasGreeted = false;
  userInput = '';
  
  messages = signal<Message[]>([
    { text: '¡Hola! Soy <strong>Bappie IA</strong>. Estoy para ayudarte a encontrar el oficio que buscas o resolver tus dudas.', type: 'msg-bot' }
  ]);

  suggestions = ["¿Qué oficios hay?", "¿Cómo agendar?", "¿Tiene costo?"];
  
  ngOnInit() {
    // El tooltip inicial ya está visible por defecto
  }

  toggleChat() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.hasGreeted = true;
      this.showTooltip.set(false);
      this.scrollToBottom();
      if (!this.isGreeting()) {
        this.isGreeting.set(true);
        setTimeout(() => this.isGreeting.set(false), 2000);
      }
    } else {
      this.showTooltip.set(true);
    }
  }

  async handleUserInput() {
    const text = this.userInput.trim();
    if (!text || this.isProcessing()) return;

    // Agregar mensaje del usuario
    this.messages.update(m => [...m, { text, type: 'msg-user' }]);
    const currentHistory = this.messages().map(m => ({
      role: m.type === 'msg-user' ? 'user' : 'assistant',
      content: m.text
    }));
    
    this.userInput = '';
    this.isProcessing.set(true);
    this.isTyping.set(true);
    this.scrollToBottom();

    // Llamada al backend
    this.http.post<any>(`${environment.apiUrl}/assistant/chat`, {
      message: text,
      history: currentHistory.slice(-5) // Enviar últimos 5 mensajes para contexto
    }).subscribe({
      next: (res) => {
        this.isTyping.set(false);
        this.messages.update(m => [...m, { text: res.response, type: 'msg-bot' }]);
        this.isProcessing.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Bappie IA Error:', err);
        this.isTyping.set(false);
        this.messages.update(m => [...m, { 
          text: 'Lo siento, tuve un problema de conexión. ¿Podrías intentar de nuevo?', 
          type: 'msg-bot' 
        }]);
        this.isProcessing.set(false);
        this.scrollToBottom();
      }
    });
  }

  useSuggestion(suggestion: string) {
    this.userInput = suggestion;
    this.handleUserInput();
    this.suggestions = this.suggestions.filter(s => s !== suggestion);
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.chatBody) {
        this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
      }
    }, 50);
  }
}

