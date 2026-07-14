# Creating a Ticket

A ticket is the core element of the system — it represents a request for help or an issue to be resolved.

## How to Create a New Ticket

If you have access to the public form, you can submit a request without logging in, using the dedicated web address provided by your administrator.

Logged-in workers and administrators can also create a ticket manually, directly from the panel — using the **+ New ticket** button visible on the ticket list (**My Tickets** or **Tickets**). The form has three variants to choose from at the top of the page — the **ticket type** decides which fields appear and what happens after saving:

### External Ticket

A ticket filed on behalf of an outside person — e.g. by phone or in person. You enter the requester's details (email, optionally "To" and "CC"), subject, priority, and content. It behaves exactly like a ticket from the public form or email — the requester gets a confirmation email with the ticket number.

### I Need Help

When you're the one who needs help from another team (e.g. HR asks IT to grant access) — you automatically become the requester, so no contact details are needed. You only pick the **team** the request goes to — every member of that team immediately gets a push notification.

### Task for the Team

Only visible to **team managers** and administrators (see the *Teams* chapter). Lets you create a ticket and immediately assign it to chosen members of your own team — you can select several at once, with no separate "Assign" step afterward. You can also set a custom **Response deadline**, which overrides the deadline automatically computed from priority (see "Priorities" below). A manager can only create tasks for the team(s) they manage — an administrator for any team.

All three variants require a **subject** and a priority; the content field is optional.

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

For tickets arriving by email, the web form, or chat, the priority is set automatically by the AI classifier based on the message content. When creating a ticket manually in the panel, whoever creates it picks the priority from a dropdown — it defaults to P2.

SLA countdowns are visible on the ticket page and in the **Statistics** section (see the *Statistics and Opinions* chapter).

## Attachments

You can attach files to a ticket (e.g. screenshots, documents). Supported formats include: images (JPG, PNG, GIF), PDF documents, text files, and others. The maximum size for a single file is 10 MB.

## What Happens After Submitting?

After submitting a ticket:
1. You receive an email confirmation with the ticket number
2. The system may automatically assign a category based on the content
3. An administrator assigns a worker to handle the request
4. When the issue is resolved, you will receive an email notification
