# Statistics and Opinions

The **Statistics** and **Opinions** sections are visible in the sidebar only to administrators and **team managers** (see the *Teams* chapter). A manager sees data limited to the team(s) they manage — with no "all teams" option. An administrator sees global data and can switch between individual teams using the filter at the top of the page.

## Statistics

### Ticket Counters

Four tiles at the top show the number of tickets in each state: **New**, **Assigned**, **Closed**, **Deferred**.

### Time and SLA Metrics

| Metric | Meaning |
|--------|---------|
| **MTTA** | Mean Time To Assign/Answer — average time to the first response on a ticket |
| **MTTR** | Mean Time To Resolve — average time to resolving a ticket |
| **SLA response** | Percentage of tickets that met the first-response deadline determined by their priority (see the *Creating a Ticket* chapter) |
| **SLA resolution** | Percentage of tickets resolved within the deadline determined by their priority |
| **SLA warning (open)** | Number of still-open tickets approaching their SLA deadline (80% of the time budget has elapsed) |
| **SLA breach (open)** | Number of still-open tickets that have **already missed** their SLA deadline |
| **SLA response / resolution eligible** | Number of tickets counted when calculating the SLA response and SLA resolution percentages, respectively |

### CSAT (Satisfaction Rating)

**CSAT (30 days)** shows the average rating from satisfaction surveys submitted by requesters after their tickets were closed, over the last 30 days, on a 1–5 scale. Individual ratings are listed in the **Opinions** section (see below).

### Charts and Tables

- **Tickets — last 30 days** — number of new tickets per day as a bar chart
- **Top workers** — ranking of workers by number of tickets handled
- **Workload per worker** — a table showing the number of currently assigned tickets and the number that are overdue (past their SLA deadline) for each worker — useful for balancing workload across the team

## Opinions

A list of every satisfaction survey (CSAT) submitted by requesters. For each entry you'll see:

- **Number** of the ticket (a direct link to its details)
- **Subject** of the ticket
- **Rating** — 1 to 5 stars
- **Comment** — optional text added by the requester
- **Date** the rating was submitted

The list is paginated and, like Statistics, can be filtered by team (for administrators) or is automatically limited to the manager's team.

> **Where do opinions come from?** After a ticket is closed, the system sends the requester an email asking them to rate the support they received (if the feature is enabled in Settings). Clicking a rating in the email saves it without requiring a login.
