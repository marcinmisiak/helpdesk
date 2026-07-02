# Kanały: czat i skrzynki e-mail zespołów

Sekcja **Kanały czatu** (widoczna w menu bocznym wyłącznie dla administratorów) pozwala tworzyć dodatkowe, niezależne wejścia do systemu zgłoszeń, każde skierowane do konkretnego zespołu:

- **Czat** — widżet do osadzenia na dowolnej stronie WWW (np. stronie firmowej lub uczelnianej)
- **E-mail** — osobna skrzynka pocztowa (obok głównej skrzynki systemu skonfigurowanej w Ustawieniach), np. `wsparcie-it@firma.pl` obsługiwana wyłącznie przez wybrany zespół

Każdy kanał ma:

| Pole | Opis |
|------|------|
| **Nazwa** | Wewnętrzna nazwa kanału, widoczna tylko w panelu administratora |
| **Zespół docelowy** | Zespół, do którego trafiają zgłoszenia z tego kanału |
| **Typ kanału** | Czat lub e-mail |
| **Email powiadomień kanału** | Gdy nikt z zespołu nie jest aktualnie zalogowany, powiadomienie o nowym zgłoszeniu (i codzienne przypomnienie o nieodebranych sprawach) trafi na ten adres zamiast do wszystkich administratorów. Puste pole = zachowanie jak dotychczas (powiadamiani są administratorzy) |

---

## Kanał typu Czat

### Dozwolone domeny

Lista domen (jedna na linię), na których wolno osadzić widżet. Pozostaw puste, aby zezwolić na osadzenie na dowolnej stronie. To zabezpieczenie chroni przed skopiowaniem kodu osadzania na nieautoryzowaną stronę — **nie** jest to zabezpieczenie przed kimś, kto wysyła zapytania bezpośrednio do API z pominięciem przeglądarki.

### Wiadomość powitalna

Tekst wyświetlany odwiedzającemu od razu po otwarciu okna czatu.

### Kod do wklejenia na stronę

Po utworzeniu kanału typu Czat kliknij **Kod do wklejenia**, aby otrzymać gotowy fragment kodu w jednym z dwóch trybów:

- **Dymek (pływający przycisk)** — wklej fragment `<script>` tuż przed zamykającym tagiem `</body>` swojej strony. Na stronie pojawi się pływający przycisk czatu w rogu ekranu.
- **Wbudowany (iframe)** — wklej fragment `<iframe>` w miejscu, gdzie ma pojawić się panel czatu na stałe (np. na stronie kontaktowej). Czat jest widoczny od razu, bez przycisku.

Kliknij **Kopiuj**, aby skopiować kod do schowka, i wklej go w kodzie źródłowym swojej strony.

---

## Kanał typu E-mail

### Połączenie

Wybierz sposób odbioru poczty:

- **IMAP** — klasyczne połączenie do dowolnej skrzynki pocztowej (serwer, port, login, hasło, folder)
- **Microsoft 365 (Graph)** — wymaga wcześniej skonfigurowanej integracji Microsoft Graph w głównych Ustawieniach systemu; tutaj podajesz tylko adres skrzynki zespołowej korzystającej z tej samej aplikacji Azure

Dla połączenia IMAP dostępny jest przycisk **Testuj połączenie** — sprawdza poprawność danych logowania przed zapisaniem kanału.

### Opcje przetwarzania skrzynki (tylko IMAP)

| Opcja | Opis |
|-------|------|
| **Usuwaj wiadomości ze skrzynki po pobraniu** | Po utworzeniu ticketu wiadomość zostanie trwale usunięta z serwera IMAP. Przydatne, gdy skrzynka służy wyłącznie do zasilania helpdesku i nikt nie musi mieć do niej dostępu przez zwykły program pocztowy. |
| **Pobieraj również wiadomości już oznaczone jako przeczytane** | Domyślnie system pobiera tylko wiadomości nieprzeczytane. Włącz tę opcję, jeśli skrzynka zawiera wiadomości oznaczone jako przeczytane zanim kanał zaczął ją odpytywać (np. ktoś zajrzał do niej przez webmail przed konfiguracją). |
| **Automatycznie zamykaj ticket po utworzeniu** | Ticket zostaje od razu oznaczony jako zamknięty — bez wysyłania maila „zgłoszenie zamknięte” do nadawcy i bez ankiety satysfakcji. Przydatne dla skrzynek archiwalnych lub czysto powiadomieniowych (np. automatyczne alerty z innego systemu), których nikt nie obsługuje ręcznie. |

> **Ważne:** opcja „Pobieraj również wiadomości już oznaczone jako przeczytane” bez włączonego równocześnie „Usuwaj wiadomości po pobraniu” spowoduje, że ta sama przeczytana wiadomość będzie pobierana **ponownie przy każdym cyklu sprawdzania skrzynki** (co 60 sekund) — zalecane jest łączenie obu opcji razem, albo używanie pierwszej opcji osobno, gdy skrzynka ma być stale porządkowana.

> **Wskazówka:** jeśli na skrzynkę kanału trafiają automatyczne, niemonitorowane powiadomienia (np. z bramki SMS czy systemu monitoringu), rozważ też dodanie adresu nadawcy do listy **Maile systemowe** w głównych Ustawieniach (rozdział *Panel administratora*) — dzięki temu system nie będzie próbował wysyłać do niego żadnej odpowiedzi ani łączyć kolejnych, niezależnych powiadomień w jeden ticket.

---

## Edycja i usuwanie kanału

Listę kanałów można przeszukać po nazwie. Przy każdym kanale dostępne są akcje **Edytuj** i **Usuń** — usunięcie kanału nie usuwa już utworzonych na jego podstawie ticketów, pozostają one w systemie tak jak wcześniej, po prostu kanał przestaje istnieć i przestaje odbierać nową pocztę/czaty.
