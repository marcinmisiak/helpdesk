# Submitting Requests and Communication

In the Helpdesk system you can open a new request in three ways: via the web form, by sending an email, or directly from the panel (administrators). Below is a description of each method and an explanation of how communication works inside a ticket.

## Web Form

At the address provided by the administrator (e.g. `https://yourdomain.com/submit`) there is a public form — no login required.

1. Optionally select the form language using the **PL / EN / UA** buttons at the top of the page
2. Enter your **email address** — required to receive the confirmation and replies
3. Optionally select a **category** (if the administrator has configured categories)
4. Describe your issue in the **Message** field
5. Optionally attach a file (screenshot, document — max 10 MB)
6. Solve a short arithmetic problem (anti-spam verification)
7. Click **Submit request**

After submitting, you will receive a confirmation email with the ticket number.

> **Language tip:** The form automatically detects the language set in your browser. If your browser is set to Ukrainian, the form will appear in Ukrainian. You can change the language at any time using the buttons at the top — your choice will be remembered on your next visit.

## Submitting by Email

If the administrator has configured a system inbox, you can open a request by sending a message to the dedicated helpdesk email address. The system automatically:

- creates a new ticket with the message content as the description
- assigns the sender as the requester
- attaches any files from the email

Replying to an existing email thread (with the same subject and ticket number in the title) will be added as another message in the same ticket — it will not open a new request.

## Comments (Correspondence)

Comments are the public exchange of messages between a worker and the requester. Each comment:

- is visible to both sides — the worker and the person who submitted the ticket
- is sent by email to the other party when added
- creates a chronological conversation history within the ticket

**How to add a comment:**

1. Open the ticket details
2. Scroll to the **Reply** section
3. Type your message
4. Optionally add attachments
5. Click **Send reply**

The requester can reply directly by email (by replying to the message they received) — the reply will be automatically added to the ticket correspondence.

## Internal Notes

Notes are visible **only to workers and administrators** — the requester cannot see them and will not receive notifications when they are added.

Use notes for:

- recording diagnostic steps and test results
- passing information between workers handling the same request
- noting telephone or verbal agreements
- documenting the root cause of the problem and the actions taken

**How to add a note:**

1. Open the ticket details
2. Go to the **Notes** section (next to correspondence)
3. Type the note content
4. Click **Add note**

> **Important:** Before sending a comment to the requester, make sure you are in the correct reply tab — not in the notes tab. A note will never reach the client; a comment always will.

## Ticket Tracking Link

Each ticket has a unique, public link in the format:

```
https://yourdomain.com/status/XXXXXXXXXXXXXXXX
```

This link allows the requester to check the ticket status and review correspondence **without logging in** to the system. It is:

- sent automatically in the confirmation email
- generated from a random token linked to the ticket
- secure — the person with the link can only see that specific request

Workers can copy or share this link directly from the ticket view (the **Copy link** button). This is useful when the requester cannot find the confirmation email.
