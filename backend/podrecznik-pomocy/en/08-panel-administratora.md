# Administrator Panel

The administrator panel is available in the sidebar under **Settings** (visible only to accounts with the *admin* role). It allows you to configure all aspects of the system without touching any code.

---

## General — Name and Appearance

| Field | Description |
|-------|-------------|
| **Application name** | Displayed in the header, footer, and email subjects |
| **Logo** | JPG/PNG/SVG/WebP file (max 5 MB) — appears in the header and email footer |
| **Contact phone numbers** | Shown on the login page and public form |
| **Contact email addresses** | Same as above |

> **Note:** Changing the **Application name** automatically updates the subject of all email notifications sent by the system (e.g. `[SystemName] New ticket #42`). No restart is required.

---

## Application Language

The system supports three languages: **Polish**, **English**, and **Ukrainian**.

| Field | Description |
|-------|-------------|
| **Application language** | Default language for the interface and emails for users without personal preferences |

Each user can set their own language in **Users → Edit** (the *Language* field). If none is selected, the system uses the language configured here.

**How the system picks the email language:**
1. Checks the language assigned to the recipient's account
2. If none — uses the language set in Settings
3. For anonymous submitters (public form) — always uses the language from Settings

The **public form** (`/zgloszenie`) shows **PL / EN / UA** buttons so visitors can change the language. The choice is saved in the browser. On the first visit, the system automatically detects the browser language and sets it (if supported).

---

## Outgoing Mail (SMTP)

Configuration of the server through which the system sends email notifications.

| Field | Description |
|-------|-------------|
| **SMTP server / Port** | Address and port of the mail server |
| **Encryption** | TLS / SSL / none |
| **Username / Password** | Credentials for the sender account |
| **Sender email** | Address shown in the "From" field |
| **Sender name** | Name displayed to recipients |
| **Email footer** | Text appended to the end of every email |

After saving the settings, use the **Send test email** button to verify the configuration.

### Email Notification Options

| Option | Description |
|--------|-------------|
| **Notify sender about new ticket** | Sends an email to admins when a new ticket arrives (when no one is logged in) |
| **Notify submitter on ticket registration** | Sends a confirmation email to the submitter immediately after their ticket is registered — including the ticket number. Applies to tickets from email and tickets created manually by an admin. The public form always sends a confirmation regardless of this setting. |

---

## Incoming Mail (IMAP)

The system can receive emails and automatically create tickets from them or add them to existing threads.

| Field | Description |
|-------|-------------|
| **IMAP server / Port** | Address and port of the inbox |
| **Folder** | Name of the folder to monitor (usually `INBOX`) |
| **Username / Password** | Inbox credentials |

Mail is checked every 60 seconds. A reply to an email with the ticket number in the subject is added to the existing ticket, not a new one.

---

## Microsoft Graph (Alternative to IMAP)

Instead of IMAP, you can configure receiving and sending via Microsoft 365 / Exchange Online (Microsoft Graph API). This requires registering an application in the Azure Portal — see `README.md` for details.

---

## LDAP / Active Directory

### What is LDAP?

**LDAP** (Lightweight Directory Access Protocol) is a protocol for accessing user directories — databases that store employee or student accounts, email addresses, groups, and other attributes. The most common implementations are:

- **Microsoft Active Directory** — used by most Windows-based organisations
- **OpenLDAP** — a popular open-source implementation
- **University LDAP** — often a custom deployment with academic attributes (e.g. `studid`, `prow_id`, `eduPersonAffiliation`)

LDAP integration lets the helpdesk system **automatically look up** information about the person who submitted a ticket and display it in a user card on the ticket page.

---

### Key LDAP Concepts

Before configuring the connection, it helps to know a few terms:

**DN (Distinguished Name)** — the unique address of an object in the directory. Read from most specific to least specific, e.g.:
```
CN=John Smith,OU=students,DC=university,DC=edu
```

**DN components:**
| Abbreviation | Meaning | Example |
|---|---|---|
| `CN` | Common Name — the object's name | `CN=John Smith` |
| `OU` | Organizational Unit — department or group | `OU=students` |
| `DC` | Domain Component — part of the domain name | `DC=university,DC=edu` for `university.edu` |

**Base DN** — the starting point for searches. Usually the root of the domain:
```
DC=university,DC=edu
```

**Bind DN** — the service account the system uses to connect to LDAP and run queries:
```
CN=helpdesk-reader,OU=Service Accounts,DC=university,DC=edu
```
This account only needs read-only permissions.

**LDAP filter** — the search condition, e.g.:
```
(mail={email})              ← search by email address (default)
(objectClass=person)        ← all persons
(&(objectClass=user)(mail=*))  ← users with an email filled in (Active Directory)
```

---

### Configuring the Connection — Step by Step

#### Step 1: Server Address

Enter the hostname or IP address of the domain controller in the **LDAP server** field:
```
ldap.university.edu
192.168.1.10
ad.company.local
```

**Port** — standard values:
- `389` — plain LDAP or STARTTLS
- `636` — LDAPS (SSL/TLS encrypted)

If you use port 636, enable the **TLS** option.

#### Step 2: Base DN

Base DN is the search scope. Convert the domain name to `DC=` components by replacing dots:

| Domain | Base DN |
|--------|---------|
| `university.edu` | `DC=university,DC=edu` |
| `company.com` | `DC=company,DC=com` |
| `ad.university.edu.pl` | `DC=ad,DC=university,DC=edu,DC=pl` |

To narrow the search to a specific unit:
```
OU=employees,DC=company,DC=com
```

#### Step 3: Bind DN and Password

Enter the full DN of the service account and its password. Examples:

**Active Directory:**
```
CN=helpdesk-svc,CN=Users,DC=company,DC=com
```

**OpenLDAP / university LDAP:**
```
CN=admin,DC=university,DC=edu
uid=ldap-reader,ou=system,dc=university,dc=edu
```

> **Security tip:** Create a dedicated account with read-only permissions. Do not use a domain administrator account.

#### Step 4: User Filter

The default filter `(mail={email})` searches for a user by email address — this works in most cases. The `{email}` placeholder is automatically replaced with the sender's email address from the ticket.

Other useful filters:

```ldap
(mail={email})
← standard, searches the mail attribute

(&(objectClass=user)(mail={email}))
← Active Directory — limits to user objects only

(&(objectClass=inetOrgPerson)(mail={email}))
← OpenLDAP with inetOrgPerson class

(|(mail={email})(proxyAddresses=smtp:{email}))
← Active Directory with mailbox aliases
```

#### Step 5: Attributes

| Field | Description | Typical values |
|-------|-------------|----------------|
| **Name attribute** | Where to get the user's display name | `displayName`, `cn`, `sn` |
| **Type attribute** | Where to get the user's type or role | `employeeType`, `department`, `title` |

The system automatically fetches and saves these additional attributes (when available): `cn`, `uid`, `sn`, `givenName`, `displayName`, `mail`, `telephoneNumber`, `mobile`, `l`, `description`, `ou`, `department`, `title`, `employeeType`, `eduPersonAffiliation`, `studid`, `osobaid`, `prow_id`.

#### Step 6: Test the Connection

Click **Test LDAP connection**. If the test succeeds — save the settings. If not — check:
- Whether the server is reachable (ping, firewall rules)
- Whether the Bind DN and password are correct
- Whether the port and TLS settings match

---

### Sample Configurations

#### Example 1: Microsoft Active Directory (domain `company.com`)

```
Server:         ad.company.com
Port:           389
TLS:            no
Base DN:        DC=company,DC=com
Bind DN:        CN=helpdesk-reader,OU=Service Accounts,DC=company,DC=com
Password:       [service account password]
Filter:         (&(objectClass=user)(mail={email}))
Name attr:      displayName
Type attr:      department
```

#### Example 2: OpenLDAP (domain `university.edu`)

```
Server:         ldap.university.edu
Port:           389
TLS:            no
Base DN:        DC=university,DC=edu
Bind DN:        CN=admin,DC=university,DC=edu
Password:       [password]
Filter:         (mail={email})
Name attr:      cn
Type attr:      employeeType
```

#### Example 3: University LDAP with Students and Lecturers (domain `lipinski.edu.pl`)

```
Server:         ldap.lipinski.edu.pl
Port:           389
TLS:            no
Base DN:        DC=lipinski,DC=edu,DC=pl
Bind DN:        CN=admin,DC=lipinski,DC=edu,DC=pl
Password:       [password]
Filter:         (mail={email})
Name attr:      cn
Type attr:      (leave empty)
```

In this case the user type comes from the **OU** in their DN:
- Student: `CN=12345 John Smith,OU=students,DC=lipinski,DC=edu,DC=pl`
- Lecturer: `CN=67890,OU=lecturers,DC=lipinski,DC=edu,DC=pl`

The system automatically extracts the `OU=...` part and stores it as `ldap_ou` (here: `students` or `lecturers`).

---

### LDAP Card in Ticket View

When LDAP is enabled, a **user LDAP card** can appear on each ticket page — showing information about the requester pulled from the directory.

#### Enabling / Disabling the Card

The **Show LDAP card in ticket** toggle controls the card's visibility for all workers. Disabling it hides the card globally — without removing the label configuration.

---

### Labels and Conditions — Detailed Guide

The LDAP card shows the label that matches the user's data (e.g. "Student", "Lecturer"). You can define any number of labels with custom conditions.

| Field | Description |
|-------|-------------|
| **Label** | Name displayed in the card, e.g. `Student` |
| **Icon** | Emoji before the label, e.g. `🎓` |
| **Condition field** | Which LDAP attribute to check (details below) |
| **Condition value** | The expected value of that attribute |
| **Link template** | URL to an external system with the user's profile (optional) |
| **Link label** | Button text, e.g. `Open profile` |

---

#### Condition Field — How It Works

When a new ticket arrives by email, the system automatically searches LDAP for the sender's email address. The data found is stored with the ticket and displayed in the card.

The system stores two kinds of information:

**`ldap_ou`** — the Organizational Unit (OU) extracted from the user's DN.  
Example: DN = `CN=John Smith,OU=students,DC=university,DC=edu` → `ldap_ou = students`

**LDAP attributes** — all other fields returned by the server, including:  
`employeeType`, `department`, `title`, `eduPersonAffiliation`, `studid`, `osobaid`, `prow_id`, `uid`, `cn`, `displayName`, `mail`, `telephoneNumber`, `mobile`, `l`, `description`

In the **condition field** you enter one of these keys:

| Condition field | When to use | Example value |
|-----------------|-------------|---------------|
| `ldap_ou` | Users divided into OUs (students, employees) | `students` |
| `employeeType` | Employee type from an LDAP attribute | `student`, `staff`, `teacher` |
| `department` | Department or faculty | `IT`, `Finance` |
| `title` | Job title | `Professor`, `Manager` |
| `eduPersonAffiliation` | Role in an academic environment | `student`, `faculty`, `staff` |

> **How to find available attributes?** Open any ticket from a person who is in LDAP. In the LDAP card click **Show attributes** — you will see all fields retrieved from the server along with their values.

---

#### Link Template — How It Works

If you have an external system (student portal, ERP, HR) with user profiles, you can insert a link to the specific profile. Use attribute names in curly braces as placeholders:

```
https://portal.university.edu/student/{studid}
https://hr.company.com/employee/{employeeNumber}
https://erp.company.com/user/{uid}
```

Any attribute saved from LDAP can be used as a variable — e.g. `{studid}`, `{prow_id}`, `{uid}`, `{osobaid}`, `{cn}`, `{employeeNumber}`.

> If a particular attribute is empty for a given user, the corresponding part of the URL will be blank — the link will still appear but will be broken. It is best to use an attribute that is always populated.

---

### Ready-to-Use Label Examples

#### University with OU-based structure (students / lecturers)

**Label 1 — Student:**
```
Label:            Student
Icon:             🎓
Condition field:  ldap_ou
Condition value:  students
Link template:    https://portal.university.edu/student/{studid}
Link label:       Student profile
```

**Label 2 — Lecturer:**
```
Label:            Lecturer
Icon:             👨‍🏫
Condition field:  ldap_ou
Condition value:  lecturers
Link template:    https://portal.university.edu/lecturer/{prow_id}
Link label:       Lecturer profile
```

#### Company using the `employeeType` attribute

**Label 1 — Employee:**
```
Label:            Employee
Icon:             👔
Condition field:  employeeType
Condition value:  employee
Link template:    https://hr.company.com/employee/{uid}
Link label:       Employee record
```

**Label 2 — Contractor:**
```
Label:            Contractor
Icon:             🏢
Condition field:  employeeType
Condition value:  contractor
```

#### Using `department` instead of `employeeType`

```
Label:            IT Department
Icon:             💻
Condition field:  department
Condition value:  IT
```

---

#### Managing Labels

- Click **+ Add label** to define a new user type
- Use the **↑ ↓** buttons to change the order — the **first matching** label is displayed
- Click **Edit** or **Delete** next to a label

Changes take effect after clicking **Save settings** at the bottom of the page.

---

## Automatic Reminders

The system can send automatic reminder emails:

| Reminder type | Recipient | Condition |
|---------------|-----------|-----------|
| Unassigned tickets | Administrators | Ticket without a worker for X hours |
| Pending reply | Assigned worker | New message with no reply for X hours |
| Close request | Requester | Ticket "in progress" for a long time |

| Field | Description |
|-------|-------------|
| **Delay (hours)** | After how many hours without a response to send a reminder |
| **Send time** | The hour at which the check runs (once per day) |

---

## Public Form

Allows you to enable or disable the ticket submission form available without logging in (at `/zgloszenie`). You can set a custom form title displayed to visitors.

The form shows **PL / EN / UA** buttons — visitors can change the language. On the first visit, the system tries to automatically match the browser language. The choice is saved in the visitor's browser.

The public form always sends a confirmation email with the ticket number after submission (regardless of the "Notify submitter on ticket registration" option).

---

## Security and Roles

User roles (`admin`, `worker`) are assigned in the **Users** section. Each account can have exactly one role:

- **admin** — full access to settings and all tickets
- **worker** — handles assigned tickets, cannot see the settings panel

### First Administrator Account

After a fresh installation the database is empty. The first admin account is created using a script:

```bash
# Docker
docker compose exec backend node src/scripts/create-admin.js

# Native installation
node backend/src/scripts/create-admin.js
```

The script asks interactively for email, first name, last name, and password. After running it you can log in to the application and manage users from the panel.

---

## Logs and Version

The current system version (e.g. `v1.2.0`) is visible in the application footer and on the login page.
