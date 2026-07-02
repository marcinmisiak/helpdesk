# Panel administratora

Panel administratora dostępny jest w menu bocznym pod pozycją **Ustawienia** (widoczna wyłącznie dla kont z rolą *admin*). Pozwala skonfigurować wszystkie aspekty działania systemu bez ingerencji w kod.

---

## Ogólne — nazwa i wygląd

| Pole | Opis |
|------|------|
| **Nazwa aplikacji** | Wyświetlana w nagłówku, stopce i tematach wysyłanych e-maili |
| **Logo** | Plik JPG/PNG/SVG/WebP (max 5 MB) — pojawia się w nagłówku i stopce e-maili |
| **Telefony kontaktowe** | Widoczne na stronie logowania i formularzu publicznym |
| **Adresy e-mail kontaktowe** | Jak wyżej |

> **Uwaga:** Zmiana **Nazwy aplikacji** automatycznie aktualizuje temat wszystkich powiadomień e-mail wysyłanych przez system (np. `[NazwaSystemu] Nowe zgłoszenie #42`). Nie wymaga restartu.

---

## Język aplikacji

System obsługuje trzy języki: **polski**, **angielski** i **ukraiński**.

| Pole | Opis |
|------|------|
| **Język aplikacji** | Domyślny język interfejsu i e-maili dla użytkowników bez własnych preferencji |

Każdy użytkownik może ustawić swój własny język w sekcji **Użytkownicy → Edytuj** (pole *Język*). Jeśli nie wybierze żadnego, system używa języka ustawionego tutaj.

**Jak system dobiera język e-maila:**
1. Sprawdza język przypisany do konta odbiorcy
2. Jeśli brak — używa języka ustawionego w Ustawieniach
3. Dla anonimowych zgłaszających (formularz publiczny) — zawsze używa języka z Ustawień

**Formularz publiczny** (`/zgloszenie`) wyświetla przyciski **PL / EN / UA** umożliwiające zmianę języka. Wybór jest zapamiętywany w przeglądarce. Przy pierwszej wizycie system wykrywa język przeglądarki i automatycznie go ustawia (jeśli jest obsługiwany).

---

## Poczta wychodząca (SMTP)

Konfiguracja serwera, przez który system wysyła powiadomienia e-mail.

| Pole | Opis |
|------|------|
| **Serwer SMTP / Port** | Adres i port serwera pocztowego |
| **Szyfrowanie** | TLS / SSL / brak |
| **Login / Hasło** | Dane uwierzytelniające konta nadawcy |
| **E-mail nadawcy** | Adres widoczny w polu „Od" |
| **Nazwa nadawcy** | Nazwa wyświetlana odbiorcy |
| **Stopka wiadomości** | Tekst dołączany na końcu każdego e-maila |

Po zapisaniu ustawień możesz użyć przycisku **Wyślij testowy e-mail**, aby sprawdzić poprawność konfiguracji.

### Powiadomienia e-mail — opcje

| Opcja | Opis |
|-------|------|
| **Powiadamiaj nadawcę o nowym tickecie** | Wysyła e-mail do adminów gdy pojawia się nowe zgłoszenie (gdy nikt nie jest zalogowany) |
| **Powiadamiaj zgłaszającego o przyjęciu zgłoszenia** | Wysyła e-mail potwierdzający do osoby zgłaszającej zaraz po zarejestrowaniu ticketu — z numerem sprawy. Dotyczy zgłoszeń z e-maila i ręcznie tworzonych przez admina. Formularz publiczny zawsze wysyła potwierdzenie niezależnie od tej opcji. |

### Maile systemowe (bez żadnej automatycznej korespondencji)

Pole tekstowe (jeden adres na linię), w którym możesz wskazać skrzynki, które **nigdy nie powinny dostać żadnej automatycznej wiadomości** z systemu — ani potwierdzenia rejestracji zgłoszenia, ani odpowiedzi pracownika, ani ankiety CSAT, ani przypomnienia o zamknięciu.

Przeznaczone dla automatycznych, niemonitorowanych skrzynek, które trafiają do helpdesku jako "zgłaszający" — np. bramki SMS, systemy monitoringu serwerów, powiadomienia z innych aplikacji. Takie skrzynki zwykle nie odbierają poczty, więc próba wysłania do nich odpowiedzi kończy się zwrotką (bounce/NDR), a dodatkowo — bez tego ustawienia — kolejne, niezależne powiadomienia od tego samego nadawcy z podobnym tematem mogą zostać błędnie dopasowane do jednego, starego zgłoszenia zamiast utworzyć osobne tickety.

> **Jak to działa dokładnie:** dla adresu z tej listy każda nowa wiadomość zawsze zakłada nowy ticket (system nie próbuje dopasować jej po podobieństwie nadawcy i tematu do wcześniejszych zgłoszeń) — chyba że to prawdziwa odpowiedź w wątku (rozpoznana po nagłówku wiadomości) albo temat zawiera numer istniejącego zgłoszenia.

---

## Poczta przychodząca (IMAP)

System może odbierać e-maile i automatycznie tworzyć z nich zgłoszenia lub dołączać je do istniejących wątków.

| Pole | Opis |
|------|------|
| **Serwer IMAP / Port** | Adres i port skrzynki odbiorczej |
| **Folder** | Nazwa folderu do monitorowania (zazwyczaj `INBOX`) |
| **Login / Hasło** | Dane do skrzynki |

Poczta jest sprawdzana co 60 sekund. Odpowiedź na e-mail z numerem sprawy w tytule jest dołączana do istniejącego ticketu, nie tworzy nowego.

---

## Microsoft Graph (alternatywa dla IMAP)

Zamiast IMAP można skonfigurować odbiór i wysyłkę przez Microsoft 365 / Exchange Online (Microsoft Graph API). Wymaga rejestracji aplikacji w Azure Portal — szczegóły w pliku `README.md`.

---

## LDAP / Active Directory

### Co to jest LDAP?

**LDAP** (Lightweight Directory Access Protocol) to protokół dostępu do katalogów użytkowników — baz danych przechowujących konta pracowników, studentów, ich adresy e-mail, grupy i inne atrybuty. Najczęściej spotykane wdrożenia to:

- **Microsoft Active Directory** — używany w większości firm i instytucji windowsowych
- **OpenLDAP** — popularna implementacja open-source
- **LDAP uczelniany** — często własne wdrożenie z atrybutami typowymi dla środowiska akademickiego (np. `studid`, `prow_id`, `eduPersonAffiliation`)

Integracja z LDAP pozwala systemowi helpdesk **automatycznie wyszukiwać** informacje o osobie, która wysłała zgłoszenie, i wyświetlać je w karcie użytkownika na stronie ticketu.

---

### Podstawowe pojęcia LDAP

Zanim skonfigurujesz połączenie, warto znać kilka terminów:

**DN (Distinguished Name)** — unikalny adres obiektu w katalogu. Czytany od szczegółu do ogółu, np.:
```
CN=Jan Kowalski,OU=studenci,DC=uczelnia,DC=pl
```

**Składowe DN:**
| Skrót | Znaczenie | Przykład |
|-------|-----------|---------|
| `CN` | Common Name — nazwa obiektu | `CN=Jan Kowalski` |
| `OU` | Organizational Unit — jednostka/dział | `OU=studenci` |
| `DC` | Domain Component — część domeny | `DC=uczelnia,DC=pl` dla `uczelnia.pl` |

**Base DN** — punkt startowy wyszukiwania. Zazwyczaj korzeń domeny:
```
DC=uczelnia,DC=pl
```

**Bind DN** — konto serwisowe, którym system łączy się z LDAP aby wykonywać zapytania:
```
CN=helpdesk-reader,OU=Service Accounts,DC=uczelnia,DC=pl
```
To konto potrzebuje jedynie uprawnień do odczytu (read-only).

**Filtr LDAP** — warunek wyszukiwania, np.:
```
(mail={email})              ← szuka po adresie e-mail (domyślny)
(objectClass=person)        ← wszyscy użytkownicy
(&(objectClass=user)(mail=*))  ← użytkownicy z uzupełnionym mailem (Active Directory)
```

---

### Konfiguracja połączenia — krok po kroku

#### Krok 1: Adres serwera

W polu **Serwer LDAP** wpisz nazwę hosta lub adres IP kontrolera domeny:
```
ldap.uczelnia.pl
192.168.1.10
ad.firma.local
```

**Port** — standardowe wartości:
- `389` — LDAP bez szyfrowania lub z STARTTLS
- `636` — LDAPS (szyfrowane SSL/TLS)

Jeśli używasz portu 636, zaznacz opcję **TLS**.

#### Krok 2: Base DN

Base DN to zakres przeszukiwania. Zamień kropki w nazwie domeny na komponenty `DC=`:

| Domena | Base DN |
|--------|---------|
| `uczelnia.pl` | `DC=uczelnia,DC=pl` |
| `firma.com` | `DC=firma,DC=com` |
| `ad.uczelnia.edu.pl` | `DC=ad,DC=uczelnia,DC=edu,DC=pl` |

Jeśli chcesz zawęzić wyszukiwanie do konkretnej jednostki:
```
OU=pracownicy,DC=uczelnia,DC=pl
```

#### Krok 3: Bind DN i hasło

Wpisz pełny DN konta serwisowego i jego hasło. Przykłady:

**Active Directory:**
```
CN=helpdesk-svc,CN=Users,DC=firma,DC=com
```

**OpenLDAP / uczelniany LDAP:**
```
CN=admin,DC=uczelnia,DC=pl
uid=ldap-reader,ou=system,dc=uczelnia,dc=pl
```

> **Wskazówka bezpieczeństwa:** Utwórz dedykowane konto z uprawnieniami tylko do odczytu. Nie używaj konta administratora domeny.

#### Krok 4: Filtr użytkownika

Domyślny filtr `(mail={email})` wyszukuje użytkownika po adresie e-mail — działa w większości przypadków. Symbol `{email}` jest automatycznie zastępowany adresem nadawcy zgłoszenia.

Inne przydatne filtry:

```ldap
(mail={email})
← standardowy, szuka po atrybucie mail

(&(objectClass=user)(mail={email}))
← Active Directory — ogranicza do obiektów typu user

(&(objectClass=inetOrgPerson)(mail={email}))
← OpenLDAP z klasą inetOrgPerson

(|(mail={email})(proxyAddresses=smtp:{email}))
← Active Directory z aliasami skrzynek
```

#### Krok 5: Atrybuty

| Pole | Opis | Typowe wartości |
|------|------|----------------|
| **Atrybut imienia** | Skąd pobierać wyświetlaną nazwę użytkownika | `displayName`, `cn`, `sn` |
| **Atrybut typu** | Skąd pobierać typ/rolę użytkownika | `employeeType`, `department`, `title` |

System automatycznie pobiera i zapisuje te dodatkowe atrybuty (gdy są dostępne): `cn`, `uid`, `sn`, `givenName`, `displayName`, `mail`, `telephoneNumber`, `mobile`, `l`, `description`, `ou`, `department`, `title`, `employeeType`, `eduPersonAffiliation`, `studid`, `osobaid`, `prow_id`.

#### Krok 6: Test połączenia

Kliknij **Testuj połączenie LDAP**. Jeśli test się powiedzie — zapisz ustawienia. Jeśli nie — sprawdź:
- Czy serwer jest osiągalny (ping, firewall)
- Czy podany Bind DN i hasło są poprawne
- Czy port i opcja TLS są właściwie ustawione

---

### Przykładowe konfiguracje

#### Przykład 1: Microsoft Active Directory (domena `firma.com`)

```
Serwer:     ad.firma.com
Port:       389
TLS:        nie
Base DN:    DC=firma,DC=com
Bind DN:    CN=helpdesk-reader,OU=Service Accounts,DC=firma,DC=com
Hasło:      [hasło konta serwisowego]
Filtr:      (&(objectClass=user)(mail={email}))
Atr. imienia:  displayName
Atr. typu:     department
```

#### Przykład 2: OpenLDAP (domena `uczelnia.pl`)

```
Serwer:     ldap.uczelnia.pl
Port:       389
TLS:        nie
Base DN:    DC=uczelnia,DC=pl
Bind DN:    CN=admin,DC=uczelnia,DC=pl
Hasło:      [hasło]
Filtr:      (mail={email})
Atr. imienia:  cn
Atr. typu:     employeeType
```

#### Przykład 3: Uczelniany LDAP ze studentami i wykładowcami (domena `lipinski.edu.pl`)

```
Serwer:     ldap.lipinski.edu.pl
Port:       389
TLS:        nie
Base DN:    DC=lipinski,DC=edu,DC=pl
Bind DN:    CN=admin,DC=lipinski,DC=edu,DC=pl
Hasło:      [hasło]
Filtr:      (mail={email})
Atr. imienia:  cn
Atr. typu:     (puste)
```

W tym przypadku informacja o typie użytkownika pochodzi z **OU** w jego DN:
- student: `CN=12345 Jan Kowalski,OU=studenci,DC=lipinski,DC=edu,DC=pl`
- wykładowca: `CN=67890,OU=wykladowcy,DC=lipinski,DC=edu,DC=pl`

System automatycznie wyodrębnia część `OU=...` i zapisuje ją jako `ldap_ou` (tu: `studenci` lub `wykladowcy`).

---

### Karta LDAP w zgłoszeniu

Gdy w systemie włączone jest LDAP, na stronie każdego zgłoszenia może pojawiać się **karta użytkownika LDAP** — z informacjami o zgłaszającym pobranymi z katalogu.

#### Włączanie / wyłączanie karty

Przełącznik **Pokazuj kartę LDAP w zgłoszeniu** steruje widocznością karty dla wszystkich pracowników. Wyłączenie go ukrywa kartę globalnie — bez usuwania konfiguracji etykiet.

---

### Etykiety i warunki — szczegółowy opis

Karta LDAP wyświetla etykietę pasującą do danych użytkownika (np. „Student", „Wykładowca"). Możesz zdefiniować dowolną liczbę etykiet z własnymi warunkami.

| Pole | Opis |
|------|------|
| **Etykieta** | Nazwa wyświetlana w karcie, np. `Student` |
| **Ikona** | Emoji poprzedzające etykietę, np. `🎓` |
| **Pole warunku** | Który atrybut LDAP sprawdzić (szczegóły poniżej) |
| **Wartość warunku** | Jakiej wartości oczekujemy |
| **Szablon linku** | URL do zewnętrznego systemu z danymi użytkownika (opcjonalny) |
| **Etykieta linku** | Tekst przycisku, np. `Otwórz kartotekę` |

---

#### Pole warunku — jak to działa?

Gdy na skrzynkę pocztową przychodzi nowe zgłoszenie, system automatycznie przeszukuje LDAP po adresie e-mail nadawcy. Znalezione dane są zapisywane w ticket i wyświetlane w karcie.

System zapisuje dwa rodzaje informacji:

**`ldap_ou`** — jednostka organizacyjna (OU) wyodrębniona z DN użytkownika.
Przykład: DN = `CN=Jan Kowalski,OU=studenci,DC=uczelnia,DC=pl` → `ldap_ou = studenci`

**Atrybuty LDAP** — wszystkie pozostałe pola zwrócone przez serwer, m.in.:
`employeeType`, `department`, `title`, `eduPersonAffiliation`, `studid`, `osobaid`, `prow_id`, `uid`, `cn`, `displayName`, `mail`, `telephoneNumber`, `mobile`, `l`, `description`

W **polu warunku** wpisujesz jeden z tych kluczy:

| Pole warunku | Kiedy użyć | Przykład wartości |
|--------------|------------|------------------|
| `ldap_ou` | Użytkownicy podzieleni na OU (studenci, pracownicy) | `studenci` |
| `employeeType` | Typ pracownika z atrybutu LDAP | `student`, `staff`, `teacher` |
| `department` | Oddział lub wydział | `IT`, `Administracja` |
| `title` | Stanowisko | `Profesor`, `Kierownik` |
| `eduPersonAffiliation` | Rola w środowisku akademickim | `student`, `faculty`, `staff` |

> **Jak sprawdzić dostępne atrybuty?** Otwórz dowolne zgłoszenie od osoby, która jest w LDAP. W karcie LDAP kliknij **Pokaż atrybuty** — zobaczysz wszystkie pola pobrane z serwera wraz z ich wartościami.

---

#### Szablon linku — jak to działa?

Jeśli masz zewnętrzny system (dziekanat, ERP, HR) z kartotekami użytkowników, możesz wstawić link do konkretnej kartoteki. W szablonie używaj nazw atrybutów w nawiasach klamrowych:

```
https://system.uczelnia.pl/student/{studid}
https://hr.firma.pl/pracownik/{employeeNumber}
https://erp.firma.pl/user/{uid}
```

Dostępne zmienne to wszystkie atrybuty zapisane przez LDAP — np. `{studid}`, `{prow_id}`, `{uid}`, `{osobaid}`, `{cn}`, `{employeeNumber}`.

> Jeśli dany atrybut jest pusty dla konkretnego użytkownika, odpowiadający fragment URL będzie pusty — link i tak się pojawi, ale będzie nieprawidłowy. Warto więc używać atrybutu, który jest zawsze uzupełniony.

---

### Przykładowe etykiety — gotowe do użycia

#### Uczelnia z podziałem na OU (studenci / wykładowcy)

**Etykieta 1 — Student:**
```
Etykieta:          Student
Ikona:             🎓
Pole warunku:      ldap_ou
Wartość warunku:   studenci
Szablon linku:     https://dziekanat.uczelnia.pl/student/{studid}
Etykieta linku:    Kartoteka studenta
```

**Etykieta 2 — Wykładowca:**
```
Etykieta:          Wykładowca
Ikona:             👨‍🏫
Pole warunku:      ldap_ou
Wartość warunku:   wykladowcy
Szablon linku:     https://dziekanat.uczelnia.pl/prowadzacy/{prow_id}
Etykieta linku:    Kartoteka wykładowcy
```

#### Firma z atrybutem `employeeType`

**Etykieta 1 — Pracownik:**
```
Etykieta:          Pracownik
Ikona:             👔
Pole warunku:      employeeType
Wartość warunku:   employee
Szablon linku:     https://hr.firma.pl/pracownik/{uid}
Etykieta linku:    Karta pracownika
```

**Etykieta 2 — Zewnętrzny:**
```
Etykieta:          Zewnętrzny
Ikona:             🏢
Pole warunku:      employeeType
Wartość warunku:   contractor
```

#### Użycie `department` zamiast `employeeType`

```
Etykieta:          Dział IT
Ikona:             💻
Pole warunku:      department
Wartość warunku:   IT
```

---

#### Zarządzanie etykietami

- Kliknij **+ Dodaj etykietę**, aby zdefiniować nowy typ użytkownika
- Użyj przycisków **↑ ↓** aby zmienić kolejność — wyświetlana jest **pierwsza pasująca** etykieta
- Kliknij **Edytuj** lub **Usuń** przy wybranej etykiecie

Zmiany obowiązują po kliknięciu **Zapisz ustawienia** na dole strony.

---

## Przypomnienia automatyczne

System może wysyłać automatyczne e-maile przypominające:

| Typ przypomnienia | Odbiorca | Warunek |
|------------------|----------|---------|
| Nieprzypisane zgłoszenia | Administratorzy | Ticket bez pracownika od X godzin |
| Oczekująca odpowiedź | Przypisany pracownik | Nowa wiadomość bez odpowiedzi od X godzin |
| Prośba o zamknięcie | Zgłaszający | Ticket „w toku" od dłuższego czasu |

| Pole | Opis |
|------|------|
| **Opóźnienie (godz.)** | Po ilu godzinach bez reakcji wysłać przypomnienie |
| **Godzina wysyłki** | O której godzinie uruchamia się sprawdzanie (raz dziennie) |

---

## Formularz publiczny

Pozwala włączyć lub wyłączyć formularz zgłoszeniowy dostępny bez logowania (pod adresem `/zgloszenie`). Można ustawić własny tytuł formularza wyświetlany odwiedzającym.

Formularz wyświetla przyciski **PL / EN / UA** — odwiedzający może wybrać język. Przy pierwszej wizycie system próbuje automatycznie dopasować język przeglądarki. Wybór jest zapamiętywany w przeglądarce użytkownika.

Formularz publiczny zawsze wysyła e-mail potwierdzający przyjęcie zgłoszenia z numerem sprawy (niezależnie od opcji „Powiadamiaj zgłaszającego o przyjęciu zgłoszenia").

---

## Dziennik zdarzeń zgłoszeń (audyt)

| Pole | Opis |
|------|------|
| **Zapisuj dziennik zdarzeń zgłoszenia** | Włącza/wyłącza rejestrowanie historii działań na zgłoszeniach (domyślnie włączone) |

Gdy opcja jest włączona, system zapisuje chronologiczny zapis tego, co działo się z każdym zgłoszeniem: kto i kiedy je utworzył, przydzielił, odpowiedział, zamknął, ponownie otworzył, przekazał, scalił, oznaczył jako spam, zredagował itd. — łącznie z akcjami wykonanymi masowo (np. „Zamknij zaznaczone”). Dziennik jest widoczny na stronie każdego zgłoszenia, w karcie **Dziennik zdarzeń** — patrz opis w rozdziale *Moje zgłoszenia*.

Wyłączenie tej opcji **nie usuwa** już zapisanej historii — wstrzymuje tylko zapisywanie nowych wpisów. Włączenie jej z powrotem wznawia rejestrowanie od tego momentu.

---

## Bezpieczeństwo i role

Role użytkowników (`admin`, `pracownik`) przypisuje się w sekcji **Użytkownicy**. Każde konto może mieć dokładnie jedną rolę:

- **admin** — pełny dostęp do ustawień i wszystkich zgłoszeń
- **pracownik** — obsługuje przypisane zgłoszenia, nie widzi panelu ustawień

### Pierwsze konto administratora

Po świeżej instalacji baza danych jest pusta. Pierwsze konto admina tworzy się skryptem:

```bash
# Docker
docker compose exec backend node src/scripts/create-admin.js

# Instalacja natywna
node backend/src/scripts/create-admin.js
```

Skrypt pyta interaktywnie o e-mail, imię, nazwisko i hasło. Po jego wykonaniu można zalogować się do aplikacji i dalej zarządzać użytkownikami z poziomu panelu.

---

## Logi i wersja

W stopce aplikacji widoczna jest bieżąca wersja systemu (np. `v1.2.0`). Ta sama wersja pojawia się na stronie logowania.
