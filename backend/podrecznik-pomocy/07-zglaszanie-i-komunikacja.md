# Zgłaszanie spraw i komunikacja

W systemie Helpdesk możesz otworzyć nową sprawę na trzy sposoby: przez formularz internetowy, wysyłając e-mail lub bezpośrednio z panelu (administratorzy). Poniżej znajdziesz opis każdej metody oraz wyjaśnienie jak działa komunikacja wewnątrz zgłoszenia.

## Formularz internetowy

Pod adresem udostępnionym przez administratora (np. `https://twojadomena.pl/zgloszenie`) działa publiczny formularz — bez konieczności logowania się do systemu.

1. Opcjonalnie wybierz język formularza przyciskami **PL / EN / UA** widocznymi na górze strony
2. Wpisz **adres e-mail** — wymagany do otrzymania potwierdzenia i odpowiedzi
3. Opcjonalnie wybierz **kategorię** zgłoszenia (jeśli administrator skonfigurował kategorie)
4. Opisz sprawę w polu **Treść zgłoszenia**
5. Opcjonalnie dołącz plik (zrzut ekranu, dokument — max 10 MB)
6. Rozwiąż krótkie zadanie matematyczne (zabezpieczenie antyspamowe)
7. Kliknij **Wyślij zgłoszenie**

Po wysłaniu na podany adres e-mail otrzymasz potwierdzenie z numerem sprawy.

> **Wskazówka językowa:** Formularz automatycznie wykrywa język ustawiony w przeglądarce. Jeśli Twoja przeglądarka ustawiona jest na ukraiński, formularz wyświetli się po ukraińsku. Wybór możesz zmienić w dowolnym momencie przyciskami na górze strony — zostanie on zapamiętany przy kolejnej wizycie.

## Zgłoszenie przez e-mail

Jeśli administrator skonfigurował skrzynkę odbiorczą systemu, możesz otworzyć sprawę wysyłając wiadomość na dedykowany adres e-mail helpdesku. System automatycznie:

- tworzy nowy ticket z treścią wiadomości jako opisem
- przypisuje nadawcę jako zgłaszającego
- dołącza ewentualne załączniki z e-maila

Odpowiedź na istniejący wątek e-mailowy (z tym samym tematem i numerem sprawy w tytule) zostanie dodana jako kolejna wiadomość w tym samym tickecie — nie otworzy nowego zgłoszenia.

## Komentarze (korespondencja)

Komentarze to publiczna wymiana wiadomości między pracownikiem a zgłaszającym. Każdy komentarz:

- jest widoczny dla obu stron — pracownika i osoby, która złożyła zgłoszenie
- jest wysyłany e-mailem do drugiej strony w momencie dodania
- tworzy chronologiczną historię rozmowy wewnątrz ticketu

**Jak dodać komentarz:**

1. Otwórz szczegóły zgłoszenia
2. Przewiń do sekcji **Odpowiedz**
3. Wpisz treść wiadomości
4. Opcjonalnie dodaj załączniki
5. Kliknij **Wyślij odpowiedź**

Zgłaszający może odpowiedzieć bezpośrednio przez e-mail (odpowiadając na otrzymaną wiadomość) — odpowiedź zostanie automatycznie dołączona do korespondencji ticketu.

## Notatki wewnętrzne

Notatki są widoczne **wyłącznie dla pracowników i administratorów** — zgłaszający ich nie widzi i nie otrzymuje powiadomień o ich dodaniu.

Używaj notatek do:

- zapisywania kroków diagnostycznych i wyników testów
- przekazywania informacji między pracownikami obsługującymi sprawę
- odnotowania ustaleń telefonicznych lub ustnych
- dokumentowania przyczyny problemu i podjętych działań

**Jak dodać notatkę:**

1. Otwórz szczegóły zgłoszenia
2. Przejdź do zakładki **Notatki** (obok korespondencji)
3. Wpisz treść notatki
4. Kliknij **Dodaj notatkę**

> **Ważne:** Zanim wyślesz komentarz do zgłaszającego, upewnij się że jesteś w zakładce właściwej odpowiedzi — nie w notatce. Notatka nigdy nie trafi do klienta, komentarz — zawsze tak.

## Link do śledzenia zgłoszenia

Każdy ticket ma unikalny, publiczny link w formacie:

```
https://twojadomena.pl/status/XXXXXXXXXXXXXXXX
```

Link ten pozwala zgłaszającemu sprawdzić status sprawy i przejrzeć korespondencję **bez logowania** do systemu. Jest on:

- wysyłany automatycznie w e-mailu potwierdzającym zgłoszenie
- generowany na podstawie losowego tokenu powiązanego z ticketem
- bezpieczny — osoba z linkiem widzi tylko tę konkretną sprawę

Pracownicy mogą skopiować lub udostępnić ten link bezpośrednio z widoku ticketu (przycisk **Kopiuj link** lub ikona udostępniania). Przydaje się gdy zgłaszający nie wie gdzie szukać swojego e-maila z potwierdzeniem.
