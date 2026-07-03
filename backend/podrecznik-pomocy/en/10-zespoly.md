# Teams

Teams group workers who jointly handle a specific category of tickets (e.g. IT department, dean's office, technical support). Team membership affects several things in the system:

- **Reply templates** — templates assigned to a team can only be seen and edited by its members (see the *My Tickets* chapter)
- **Channels** — a chat or email channel configured by an administrator routes new tickets to a specific team (see the *Channels* chapter)
- **Assignment** — assigning a ticket to a specific person automatically moves it to that person's team
- **Sidebar counters** — a worker sees a "Team" counter — the number of tickets belonging to their team that haven't been assigned to anyone yet
- **Statistics and Opinions** — access to these sections (scoped to your own team) is limited to **team managers** and administrators

## Joining and Leaving a Team

The **Teams** section in the sidebar lists every team along with its members and manager. Each team has a button:

- **Join** — if you don't belong to the team yet
- **Leave** — if you already belong to it

Joining and leaving a team is self-service — it does not require administrator approval. You can belong to several teams at once.

## Managing Teams (Administrator)

Only an administrator can:

1. Create a new team with the **+ New team** button (name and optional description)
2. Edit a team — change its name, description, and member list
3. Grant selected members the **team manager** role (checkbox next to their name when editing the team)
4. Delete a team — this does not delete any tickets or workers, only the grouping itself; tickets and templates that were assigned to the deleted team simply lose that association

## The Team Manager Role

A team manager is a regular worker with one extra permission: access to the **Statistics** and **Opinions** sections, scoped to the team(s) they manage. Only an administrator can grant this role, when editing a team — it cannot be granted to yourself through self-service joining.

Aside from statistics access, a team manager has no additional permissions over tickets themselves — the same rules apply to them as to any other worker.
