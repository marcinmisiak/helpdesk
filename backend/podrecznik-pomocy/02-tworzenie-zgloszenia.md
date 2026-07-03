# Tworzenie zgłoszenia

Zgłoszenie (ticket) to podstawowy element systemu — reprezentuje prośbę o pomoc lub problem do rozwiązania.

## Jak utworzyć nowe zgłoszenie?

Jeśli masz dostęp do formularza publicznego, możesz zgłosić sprawę bez logowania, korzystając z dedykowanego adresu internetowego udostępnionego przez administratora.

Zalogowani użytkownicy z rolą **administratora** mogą tworzyć zgłoszenia bezpośrednio w panelu:

1. Przejdź do sekcji **Tickety** w menu
2. Kliknij przycisk **Nowy ticket**
3. Wypełnij formularz:
   - **Temat** — krótki opis sprawy
   - **Treść** — szczegółowy opis problemu
   - **Kategoria** — wybierz odpowiednią kategorię
   - **Priorytet** — określ pilność sprawy
4. Opcjonalnie dodaj załączniki (pliki, zrzuty ekranu)
5. Kliknij **Zapisz**

## Statusy zgłoszenia

Każde zgłoszenie ma jeden z trzech statusów:

| Status | Znaczenie |
|--------|-----------|
| 🟡 **Nowe** | Zgłoszenie oczekuje na przypisanie |
| 🔵 **W trakcie** | Ktoś pracuje nad Twoją sprawą |
| ✅ **Zamknięte** | Sprawa została rozwiązana |

## Priorytety

System rozróżnia trzy poziomy priorytetu, każdy z własnymi terminami SLA (czas do pierwszej reakcji / czas do rozwiązania):

| Priorytet | Termin reakcji | Termin rozwiązania |
|-----------|----------------|---------------------|
| **P1 – Krytyczny** | 1 godzina | 8 godzin |
| **P2 – Normalny** (domyślny) | 4 godziny | 24 godziny |
| **P3 – Niski** | 8 godzin | 48 godzin |

Dla zgłoszeń przychodzących e-mailem, przez formularz WWW lub czat priorytet ustawia automatycznie klasyfikator AI na podstawie treści wiadomości. Przy ręcznym tworzeniu zgłoszenia w panelu administrator wybiera priorytet samodzielnie z listy rozwijanej — domyślnie ustawiony jest P2.

Odliczanie terminów SLA widoczne jest na stronie zgłoszenia oraz w sekcji **Statystyki** (patrz rozdział *Statystyki i opinie*).

## Załączniki

Do zgłoszenia możesz dołączyć pliki (np. zrzuty ekranu, dokumenty). Obsługiwane formaty to: obrazy (JPG, PNG, GIF), dokumenty PDF, pliki tekstowe i inne. Maksymalny rozmiar pojedynczego pliku to 10 MB.

## Co dzieje się po zgłoszeniu?

Po przesłaniu zgłoszenia:
1. Otrzymujesz potwierdzenie e-mailem z numerem sprawy
2. System może automatycznie przypisać kategorię na podstawie treści
3. Administrator przypisuje pracownika do obsługi sprawy
4. Gdy sprawa zostanie rozwiązana, otrzymasz powiadomienie e-mailem
