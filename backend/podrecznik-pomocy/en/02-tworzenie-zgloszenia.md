# Creating a Ticket

A ticket is the core element of the system — it represents a request for help or an issue to be resolved.

## How to Create a New Ticket

If you have access to the public form, you can submit a request without logging in, using the dedicated web address provided by your administrator.

Logged-in users with the **administrator** role can create tickets directly from the panel:

1. Go to the **Tickets** section in the menu
2. Click the **New ticket** button
3. Fill in the form:
   - **Subject** — a brief description of the issue
   - **Content** — a detailed description of the problem
   - **Category** — select the appropriate category
   - **Priority** — indicate the urgency of the request
4. Optionally add attachments (files, screenshots)
5. Click **Save**

## Ticket Statuses

Each ticket has one of three statuses:

| Status | Meaning |
|--------|---------|
| 🟡 **New** | The ticket is waiting to be assigned |
| 🔵 **In progress** | Someone is working on your request |
| ✅ **Closed** | The issue has been resolved |

## Priorities

The system uses three priority levels, each with its own SLA targets (time to first response / time to resolution):

| Priority | Response target | Resolution target |
|----------|------------------|--------------------|
| **P1 – Critical** | 1 hour | 8 hours |
| **P2 – Normal** (default) | 4 hours | 24 hours |
| **P3 – Low** | 8 hours | 48 hours |

For tickets arriving by email, the web form, or chat, the priority is set automatically by the AI classifier based on the message content. When creating a ticket manually in the panel, the administrator picks the priority from a dropdown — it defaults to P2.

SLA countdowns are visible on the ticket page and in the **Statistics** section (see the *Statistics and Opinions* chapter).

## Attachments

You can attach files to a ticket (e.g. screenshots, documents). Supported formats include: images (JPG, PNG, GIF), PDF documents, text files, and others. The maximum size for a single file is 10 MB.

## What Happens After Submitting?

After submitting a ticket:
1. You receive an email confirmation with the ticket number
2. The system may automatically assign a category based on the content
3. An administrator assigns a worker to handle the request
4. When the issue is resolved, you will receive an email notification
