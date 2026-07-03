# My Tickets

The **My Tickets** section is your central hub for managing all requests that have been assigned to you or that you submitted yourself.

## List View

The ticket list displays the most important information about each request:

- **Number** — a unique identifier for the ticket
- **Subject** — a brief description of the issue
- **Status** — the current state of the ticket
- **Date** — when it was submitted or last updated

Click any ticket to view its details.

## Ticket Details View

On the ticket details page you will find:

### Correspondence
A full history of message exchanges — all replies and comments in chronological order.

### Adding a Reply
To reply to a ticket:
1. Scroll to the bottom of the page
2. Type your message in the text field
3. Optionally attach files
4. Click **Send reply**

Your reply will be sent by email to the person who submitted the ticket.

**AI suggestion:** the **🤖 Suggest AI reply** button above the text field generates a draft reply based on the ticket content and the correspondence so far. The suggestion is inserted into the text field — read it and edit it before sending, just like with a template.

### Internal Notes
Notes are visible only to workers and administrators — the requester cannot see them. Use notes to record working information, diagnostic steps, or internal findings.

### Attachments
In the attachments section you can:
- Browse files added to the ticket
- Download attachments by clicking their names
- Add new files

### Event Log (Ticket History)
The **Event Log** card shows a chronological history of what happened to the ticket: who created it and when, who it was assigned to (yourself or another worker/team), when it was replied to, its status changes, closing, reopening, forwarding, merging with another ticket, or being marked as spam. Each entry shows the person responsible (or "System" for automatic events, e.g. an incoming email) and the exact time.

This section only appears on the ticket page once it has at least one recorded entry, and only if the administrator hasn't disabled the feature in Settings.

### Assigning a Ticket

The **Assign** button on the ticket page opens a dialog with two tabs:

- **Worker** — assigns the ticket to a specific person (you can also assign it to yourself)
- **Team** — assigns the ticket to an entire team, without naming a specific person

You can remove an assigned person or team using the **×** button next to their name in the assignment list.

> **Note:** assigning a ticket to a specific person who belongs to a team automatically moves the ticket to that person's team — even if the ticket was previously assigned to a different team. This keeps the ticket counted in the statistics of the team that is actually handling it.

### Forwarding a Ticket

The **📤 Forward** button sends the ticket content to an external email address (e.g. another department or vendor), with an optional message of your own. If the recipient replies to that email, their reply is automatically saved into the same ticket and sent on to the original requester — no need to copy it over manually.

### Merging Tickets

If the same request ended up in the system twice (e.g. the customer wrote in twice), use the **Merge** button to combine the duplicate into the correct ticket:

1. Open the duplicate (the ticket you want to merge)
2. Click **Merge**
3. Enter the number of the target ticket the duplicate should be merged into
4. Confirm

All correspondence and files from the duplicate are moved to the target ticket, and the duplicate is automatically closed and marked as merged — its page shows a link to the target ticket, and the target ticket shows a note listing the tickets merged into it.

## Reply Templates

Instead of writing similar replies from scratch, use a ready-made template. In the reply field, pick a template from the dropdown (📋 icon) — its content is inserted into the text field, where you can still edit it before sending.

Template management is available in the sidebar under **Reply Templates**:

- **Global templates** — created by an administrator, visible and usable by every worker, but only an administrator can edit or delete them
- **Team templates** — assigned to a specific team; any member of that team can add, edit, and delete them. A team template is only visible to and usable by members of that team

If you don't belong to any team, you cannot add your own templates — join a team first in the **Teams** section. An administrator can see and manage every template, regardless of team.

## Tickets Marked as Spam

The system automatically classifies some new tickets as spam (based on AI analysis and a local list of known senders) — these tickets do not appear in the standard lists. You can also manually mark any ticket as spam using the **Mark as spam** button on its page.

All tickets marked as spam are listed in the **Spam** section in the sidebar (the counter next to it shows how many). From that list you can:

- **Unmark** (restore) a single ticket with the **Not spam** button — it returns to the normal workflow and the sender is added to the trusted list
- **Permanently delete** selected tickets or all spam at once

## Filtering and Sorting

You can filter the ticket list by:
- **Text search** — the field at the top of the list searches the subject, the requester's email address, and the ticket number
- **Status** — by default only active tickets (new + assigned) are shown; pick a specific status, or the "None (all, regardless of status)" option to also include closed tickets
- **Priority** — P1/P2/P3 (see the *Creating a Ticket* chapter)
- **Date** — from newest or oldest

## Closing a Ticket

When an issue is resolved, an administrator or assigned worker changes the status to **Closed**. You will receive an email notification.

> **Tip:** If the problem recurs after the ticket is closed, open a new ticket and reference the number of the previous request.
