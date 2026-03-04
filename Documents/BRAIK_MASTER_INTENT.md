1. Purpose

Braik is a football-first web application designed to provide structured operational infrastructure for sports programs.
Its primary purpose is to reduce administrative overload on coaches by centralizing communication, scheduling, roster management, and organizational workflows while preserving real-world coaching hierarchies and authority.

Braik assists coaches; it does not replace coaching judgment or decision-making.

2. Scope Definition
2.1 What Braik IS

A role-aware operational platform for sports programs

A single source of truth for program organization

A communication and coordination system aligned with real coaching structures

A football-first product architected to support other team sports later

A web application (not a static website)

2.2 What Braik is NOT

Not a school SIS or district integration

Not a medical or health records system

Not a film hosting or film breakdown platform

Not an autonomous decision-maker

Not a consumer social network

Film hosting is explicitly out of scope for v1.

3. Program Model
3.1 Program Structure

A program represents one sport at one school

Football programs may contain:

Varsity

JV

Optional Freshman teams

Teams are separate by level (no cross-level visibility)

Staff and infrastructure are shared within the program

3.2 Multi-Sport Support

Each sport is a separate program

School-level grouping exists only for billing/discount purposes

No shared data between programs by default

4. Roles & Authority Model
4.1 Platform Owner (Super Admin)

Ultimate authority across all programs

Can:

View all programs

Adjust billing and account status

Disable AI usage

View message metadata and content (for disputes)

Force logout users

Soft-delete or hard-delete programs/users

Can impersonate Head Coach in read-only mode only

Only Head Coaches may contact Platform Owner

4.2 Head Varsity Coach

Full administrative authority within their program

Can:

Manage staff roles

Manage rosters

Control calendar, messaging, depth charts

Communicate with all roles

Communicate with parents

Approve AI-sensitive actions

Is the single point of accountability per program

4.3 Assistant Coaching Hierarchy
Coordinator Level

Offensive Coordinator (OC)

Defensive Coordinator (DC)

Special Teams Coordinator (ST)

Permissions:

Full control over their respective units

Can create/edit calendar events scoped to their players

Can message players within their unit

Can edit depth charts within their unit

Can manage position coaches beneath them

Position Coaches

Scoped strictly to their assigned position group

Can:

Message their players

Create/edit position-level events

Edit depth chart positions for their group

Cannot access parents or other units

4.4 Players

View-only role with limited interaction

Can:

View calendar events relevant to them

Message coaches (within hierarchy)

Upload profile photo (Head Coach approval required)

Acknowledge announcements

Submit absence notices (to Head Coach + position coach)

View depth charts (read-only)

Cannot:

Modify data

Edit events

Message parents

Modify depth charts

Attendance is tracked by coaches, not players.

4.5 Parents (High School & Younger Only)

Linked directly to a specific player

Can:

View Head Coach events

Receive announcements

View all message threads involving their child (read-only)

Participate only in a shared Parent + Player + Head Coach chat

Cannot:

Message assistant coaches

Modify data

Participate in player-only or staff chats

Parent access does not apply at the university level.

5. Messaging System

Permanent General Chat exists in all conversations

Coach-created threads allowed

Players and parents may reply in threads but cannot create them

Attachments allowed:

PDFs

Images

Documents

Short video clips (non-film)

Parent visibility applies to all player conversations (HS only)

Short video clips are intended for instructional or informational use and are not to be treated as film libraries or analysis assets.

6. Calendar System

Event visibility follows strict hierarchy:

Head Coach → all

Coordinators → their units

Position coaches → their players

Editing/removal authority is hierarchical

Players:

View relevant events

Add private notes only

Parents:

View Head Coach events only

Events are linked contextually to chats and announcements

7. Depth Charts & Formations

Roster is the single source of truth

Depth charts are:

Always current

Never versioned

Editing authority mirrors coaching hierarchy

All roles see identical formation layouts

Only player movement permissions differ by role

Varsity, JV, Freshman are strictly separated

8. AI Assistant
8.1 Purpose

AI exists to:

Reduce administrative burden

Execute structured operational tasks

Answer contextual questions

8.2 Authority & Constraints

AI follows the same role hierarchy as users

AI may execute actions without confirmation except:

Announcements to parents (Head Coach only)

Any roster modification (Head Coach approval required)

8.3 Monetization

AI is a paid per-season add-on

Usage is role-weighted and capped

AI may downgrade to suggestion-only mode near limits

9. Billing Model

Billed per season

Grace period allowed pre-season (June–July)

Payment due by first game week

Read-only mode permits viewing of existing data but disables creation, modification, messaging, calendar edits, and AI execution.

AI remains a premium feature

10. Dashboard & Notifications
10.1 Dashboard

Uniform layout across all roles

Displays:

Program info

Season record

Division/standing (External standings integrations are best-effort and may be stubbed or manually entered in v1 if automated sources are unavailable.)

Calendar (primary focus)

Updates and announcements

10.2 Notifications

In-app notifications for all roles

Email notifications for Head Coach only:

Announcements

Events

Billing

Account status

11. Development Rules (Critical)

No agent may modify multiple domains at once

Agents must obey this document

Film functionality is explicitly excluded

Mobile app is post-web and out of scope for v1

Consistency and hierarchy override feature expansion

Agents may not invent features, roles, permissions, or workflows not explicitly defined in this document.

12. Guiding Principle

If a feature does not:

reduce chaos

respect hierarchy

improve clarity

…it does not belong in Braik v1.

13. ## Inventory System

Braik includes an internal inventory tracking system for physical team assets.

### Purpose
The inventory system exists to provide accountability and visibility for equipment issued to players and staff. It is operational in nature and does not perform financial or procurement functions.

### Scope
Inventory may include, but is not limited to:
- Helmets
- Pads
- Uniforms
- Training equipment
- Other team-issued gear

### Permissions
- Head Coach: Full access to all inventory
- Coordinators: View and manage inventory for their unit
- Position Coaches: View and assign inventory to their players
- Players: View inventory assigned to them (read-only)
- Parents: No access

### Constraints
- Inventory is not a purchasing, budgeting, or accounting system
- No vendor or external integrations
- Inventory is not publicly visible


14. ## Documents & Resources

Braik includes a structured documents and resources system for program knowledge and materials.

### Purpose
The documents system exists to centralize and distribute program materials such as playbooks, installs, and coaching resources in a role-aware manner.

### Scope
Documents may include:
- Playbooks
- Install PDFs
- Diagrams
- Coaching resources
- Program documents

### Permissions
- Head Coach: Full access
- Coordinators: Access to unit-specific documents
- Position Coaches: Access to position-specific documents
- Players: View-only access to assigned resources
- Parents: No access unless explicitly shared by Head Coach

### Capabilities
- Organized by folders or categories
- Documents can be linked into:
  - Messages
  - Announcements
  - Calendar events

### Constraints
- This system is not film hosting or breakdown
- No annotation, telestration, or analysis tools
- No public sharing links


**- Inventory and Documents are separate systems and must not be merged or conflated by agents.

15. ## User Interface (UI) Architecture & Integration

### Purpose
The Braik user interface exists to surface, connect, and orchestrate existing backend systems in a clear, role-aware, and consistent manner.  
The UI is a **presentation and navigation layer**, not a source of business logic or authority.

All rules, permissions, and workflows are enforced by backend systems.  
The UI must never bypass or redefine those rules.

---

### Core UI Principles

- The UI must feel like **one cohesive application**, not a collection of tools
- Layout structure is **uniform across roles**
- Differences between users are based on **data visibility**, not UI structure
- UI convenience must never override:
  - hierarchy
  - permissions
  - approval requirements

---

### System Integration Model

Each core system is a **source of truth**:

- Messaging → conversations, threads, attachments
- Calendar → events and scheduling
- Depth Charts → formations and player placement
- Inventory → physical equipment tracking
- Documents & Resources → playbooks and materials
- AI Assistant → task execution and Q&A
- Billing → account state and access gating
- Admin → platform enforcement and overrides

The UI:
- Aggregates data from these systems
- Links between related entities (e.g., event → chat → document)
- Never mutates data outside of approved backend actions

Systems must not be tightly coupled through the UI.

---

### Dashboard Model

The dashboard is a **read-oriented command center**, not an editor.

All roles share the same dashboard layout structure:

1. Program header:
   - Program name
   - Season
   - Record
   - Division / standing (best-effort integration or manual fallback)

2. Calendar (primary focus):
   - Role-scoped visibility
   - Upcoming events only
   - No editing from the dashboard

3. Updates & announcements:
   - Recent announcements
   - Status acknowledgments where applicable

Navigation from the dashboard routes users to the appropriate system for actions.

---

### Role-Based UI Visibility

UI components must be conditionally rendered based on role permissions.

- Head Coach:
  - Full visibility into all systems
- Assistant Coaches:
  - Visibility limited to their scope (unit / position)
- Players:
  - Read-only views of relevant systems
- Parents:
  - Read-only views limited to Head Coach–approved content
- Platform Owner:
  - Access to admin interfaces only

The UI must **hide** inaccessible features but never assume authority.

---

### Navigation & Layout

- Navigation must be consistent across roles
- Systems should be accessible through predictable entry points
- No duplicate workflows across systems
- Admin interfaces must be visually and structurally separated from program UI

---

### AI Assistant UI

- The AI assistant is available as a persistent widget across the application
- The UI must:
  - Clearly indicate when AI is drafting vs executing
  - Require explicit confirmation for restricted actions
- The AI UI must never obscure approval requirements or permissions

---

### Constraints

- The UI must not:
  - invent new workflows
  - merge unrelated systems
  - allow actions that backend permissions disallow
  - expose administrative functions to non-authorized roles
- UI refactors must not alter backend behavior

---

### Guiding UI Rule

If a UI change:
- simplifies the interface but breaks hierarchy, or
- improves convenience but reduces accountability

…it must not be implemented.

16. Hero / Landing Page
## Public Hero & Landing Experience

### Purpose
The Braik hero and landing experience exists to build trust with coaches by clearly communicating the mission, philosophy, and real-world value of the platform before authentication.

The primary goal of the landing experience is not rapid conversion, but confidence:
- confidence that Braik understands the realities of coaching
- confidence that Braik will reduce workload, not add to it
- confidence that Braik is budgetable, intentional, and built for real programs

---

### Core Principle
The hero page must sell **relief and structure**, not software features.

Braik is positioned as:
- a support system`
- a unifying layer
- a helping hand for coaches carrying too many responsibilities

---

### Audience
The hero and landing experience is designed primarily for:
- high school head coaches
- coaching staffs with limited administrative support
- programs managing Varsity and JV teams
- coaches responsible for communication, scheduling, payments, and organization

Secondary audiences include youth programs and small colleges with similar constraints.

---

### Hero Messaging Guidelines
- Language must remain calm, grounded, and coach-first
- Avoid hype, urgency, or aggressive SaaS marketing language
- Avoid technical jargon and feature-heavy explanations
- Emphasize understanding of the coaching role and daily realities

The following concepts should be communicated early:
- Coaches today are expected to manage far more than coaching
- Administrative and operational work consumes time and focus
- Braik exists to carry that operational load

---

### Structural Expectations (Hero Page)

The hero and landing page should follow a clear narrative flow:

1. Identity & Relief  
   - Establish Braik’s mission and purpose
   - Reinforce that Braik supports the program, not distracts from coaching

2. Problem Validation  
   - Reflect the reality of administrative overload
   - Validate the coach’s lived experience

3. Reframing Braik  
   - Present Braik as a unified system replacing stacked tools
   - Emphasize simplification and structure over feature accumulation

4. Built for Real Programs  
   - Highlight limited staff, tight budgets, and seasonal planning
   - Reinforce budgetability and alignment with team dues

5. Varsity & JV Program Structure  
   - Surface the unified program model early
   - Emphasize clear authority boundaries and oversight
   - Reinforce that Braik reflects how real programs operate

6. High-Level Capabilities  
   - Provide a lightweight overview of core operational areas
   - Avoid exhaustive feature lists on the hero page

7. AI Assistant (Optional Support)  
   - Present AI as a supportive, optional assistant
   - Avoid positioning AI as the primary selling point
   - Avoid claims of full automation or replacement of staff

8. Calm Call to Action  
   - Encourage exploration and understanding
   - Avoid pressure-based or urgency-driven language

---

### Login & Returning Users
- Login access must remain available for returning users
- Login should not visually compete with the hero narrative
- Login should be clearly labeled as intended for existing users

---

### Separation from Application UI
- The hero and landing experience is distinct from the authenticated application UI
- Changes to the hero page must not alter:
  - dashboards
  - navigation
  - application layouts
  - authenticated workflows

Brand consistency should be maintained, but operational UI patterns are not required to match the marketing layout.

---

### Constraints
The hero and landing experience must not:
- promise features not currently available
- emphasize future film tools as a selling point
- convert pricing language to monthly SaaS subscriptions
- remove or dilute the seasonal, per-program pricing philosophy
- overwrite the established Braik voice with generic marketing copy

