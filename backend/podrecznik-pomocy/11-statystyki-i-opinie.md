# Statystyki i opinie

Sekcje **Statystyki** i **Opinie** są widoczne w menu bocznym wyłącznie dla administratorów i **kierowników zespołów** (patrz rozdział *Zespoły*). Kierownik widzi dane ograniczone do zespołu (lub zespołów), którymi kieruje — bez opcji „wszystkie zespoły”. Administrator widzi dane globalne oraz może przełączać się między poszczególnymi zespołami filtrem u góry strony.

## Statystyki

### Liczniki zgłoszeń

Cztery kafelki na górze pokazują liczbę zgłoszeń w poszczególnych stanach: **Nowe**, **Przypisane**, **Zamknięte**, **Odłożone**.

### Wskaźniki czasowe i SLA

| Wskaźnik | Znaczenie |
|----------|-----------|
| **MTTA** | Średni czas do pierwszej reakcji na zgłoszenie (Mean Time To Assign/Answer) |
| **MTTR** | Średni czas do rozwiązania zgłoszenia (Mean Time To Resolve) |
| **SLA reakcja** | Odsetek zgłoszeń, w których zmieszczono się w terminie pierwszej reakcji wynikającym z priorytetu (patrz rozdział *Tworzenie zgłoszenia*) |
| **SLA rozwiązanie** | Odsetek zgłoszeń rozwiązanych w terminie wynikającym z priorytetu |
| **SLA warning (open)** | Liczba wciąż otwartych zgłoszeń, które zbliżają się do przekroczenia terminu SLA (80% czasu już minęło) |
| **SLA breach (open)** | Liczba wciąż otwartych zgłoszeń, które **już przekroczyły** termin SLA |
| **N próby SLA reakcji / rozwiązania** | Liczba zgłoszeń branych pod uwagę przy liczeniu odpowiednio wskaźnika SLA reakcji i SLA rozwiązania |

### CSAT (ocena satysfakcji)

**CSAT (30 dni)** pokazuje średnią ocenę z ankiet satysfakcji przesłanych przez zgłaszających po zamknięciu ich zgłoszeń w ostatnich 30 dniach, w skali 1–5. Szczegóły poszczególnych ocen znajdziesz w sekcji **Opinie** (patrz niżej).

### Wykresy i tabele

- **Tickety — ostatnie 30 dni** — liczba nowych zgłoszeń dziennie w formie wykresu słupkowego
- **Top pracownicy** — ranking pracowników według liczby obsłużonych zgłoszeń
- **Obciążenie per pracownik** — tabela z liczbą wszystkich aktualnie przypisanych zgłoszeń oraz liczbą przeterminowanych (po terminie SLA) dla każdego pracownika — przydatne do wyrównywania obciążenia w zespole

## Opinie

Lista wszystkich ankiet satysfakcji (CSAT) przesłanych przez zgłaszających. Dla każdej opinii widoczne są:

- **Numer** zgłoszenia (link bezpośrednio do jego szczegółów)
- **Temat** zgłoszenia
- **Ocena** — od 1 do 5 gwiazdek
- **Komentarz** — opcjonalny tekst dodany przez zgłaszającego
- **Data** przesłania opinii

Lista jest stronicowana i — tak jak Statystyki — może być filtrowana według zespołu (dla administratora) lub automatycznie ograniczona do zespołu kierownika.

> **Skąd biorą się opinie?** Po zamknięciu zgłoszenia system wysyła zgłaszającemu e-mail z prośbą o ocenę obsługi (jeśli funkcja jest włączona w Ustawieniach). Kliknięcie oceny w e-mailu zapisuje ją bez konieczności logowania.
