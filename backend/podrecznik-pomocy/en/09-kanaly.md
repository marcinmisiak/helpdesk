# Channels: Chat Widget and Team Mailboxes

The **Chat Channels** section (visible in the sidebar for administrators only) lets you create additional, independent entry points into the ticketing system, each routed to a specific team:

- **Chat** — a widget you embed on any website (e.g. your company or school site)
- **Email** — a separate mailbox (alongside the system's main inbox configured in Settings), e.g. `support-it@company.com` handled exclusively by the chosen team

Every channel has:

| Field | Description |
|-------|-------------|
| **Name** | Internal channel name, visible only in the admin panel |
| **Target team** | The team that receives tickets from this channel |
| **Channel type** | Chat or Email |
| **Channel notification email** | When no one from the team is currently logged in, the new-ticket notification (and the daily reminder about pending tickets) goes to this address instead of to every administrator. Leave empty to keep the previous behavior (administrators get notified) |

---

## Chat Channel

### Allowed domains

A list of domains (one per line) where the widget is allowed to be embedded. Leave empty to allow embedding on any site. This protects against the embed snippet being copy-pasted onto an unauthorized site — it is **not** protection against someone sending requests directly to the API, bypassing the browser.

### Welcome message

Text shown to the visitor as soon as the chat window opens.

### Embed code

Once a Chat channel is created, click **Embed code** to get a ready-to-use snippet in one of two modes:

- **Bubble (floating button)** — paste the `<script>` snippet right before the closing `</body>` tag of your page. A floating chat button will appear in the corner of the screen.
- **Embedded (iframe)** — paste the `<iframe>` snippet wherever the chat panel should permanently appear (e.g. on a contact page). The chat is visible immediately, with no button.

Click **Copy** to copy the code to your clipboard and paste it into your page's source.

---

## Email Channel

### Connection

Choose how mail is received:

- **IMAP** — a classic connection to any mailbox (server, port, login, password, folder)
- **Microsoft 365 (Graph)** — requires the Microsoft Graph integration to already be configured in the main system Settings; here you only enter the team mailbox address, which uses the same Azure application

For IMAP connections, a **Test connection** button is available to verify the login details before saving the channel.

### Mailbox processing options (IMAP only)

| Option | Description |
|--------|-------------|
| **Delete messages from the mailbox after fetching** | Once a ticket is created, the message is permanently deleted from the IMAP server. Useful when the mailbox exists only to feed the helpdesk and no one needs to access it through a regular mail client. |
| **Also fetch messages already marked as read** | By default the system only fetches unread messages. Enable this if the mailbox already contains messages marked as read before the channel started polling it (e.g. someone checked it via webmail before configuration). |
| **Automatically close the ticket after creation** | The ticket is immediately marked as closed — without sending a "ticket closed" email to the sender and without a satisfaction survey. Useful for archival or purely notification mailboxes (e.g. automated alerts from another system) that nobody handles manually. |

> **Important:** enabling "Also fetch messages already marked as read" without also enabling "Delete messages after fetching" means the same read message will be fetched **again on every polling cycle** (every 60 seconds) — it's recommended to combine both options, or to use the first option on its own when the mailbox should be continuously cleaned up.

> **Tip:** if a channel mailbox receives automated, unmonitored notifications (e.g. from an SMS gateway or a monitoring system), consider also adding the sender's address to the **System emails** list in the main Settings (see the *Admin Panel* chapter) — this stops the system from trying to send it any reply, and from merging further independent notifications into a single ticket.

---

## Editing and Deleting a Channel

The channel list can be searched by name. Each channel has **Edit** and **Delete** actions — deleting a channel does not delete the tickets already created from it; they remain in the system exactly as before, the channel simply stops existing and stops receiving new mail/chats.
