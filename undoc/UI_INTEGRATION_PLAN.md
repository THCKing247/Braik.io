# UI Integration & Layout Plan

## Overview
This document outlines the unified UI structure for Braik, ensuring all systems (Messaging, Calendar, Depth Charts, Inventory, Documents, AI Assistant, Admin) are integrated into a cohesive interface that respects role-based visibility.

## Current State Analysis

### Existing Systems
- ✅ Dashboard (main page with calendar, updates, announcements)
- ✅ Messages (messaging-manager component)
- ✅ Calendar/Schedule (calendar-widget, schedule page)
- ✅ Roster (roster-manager-enhanced with depth chart tab)
- ✅ Inventory (inventory-manager component)
- ✅ Documents (documents-manager component)
- ✅ Announcements (announcements-manager component)
- ✅ Payments/Collections (payments-manager, collections-manager)
- ✅ AI Assistant (ai-widget-wrapper, ai-assistant-card)
- ⚠️ Platform Owner Admin (API exists, UI missing)

### Current Navigation Structure
- **Top Nav (DashboardNav)**: Dashboard, Subscription, Settings, Film
- **Sidebar (QuickActionsSidebar)**: Dashboard, Roster, Schedule, Announcements, Messages, Documents, Collections, Payments, Inventory, Invites

### Issues Identified
1. Navigation split between top nav and sidebar creates confusion
2. Depth charts are buried in roster tab (not immediately discoverable)
3. Platform Owner has no UI access to admin functions
4. Inconsistent page headers/layouts across pages
5. Some systems feel disconnected (e.g., Schedule vs Calendar on dashboard)

## Proposed Unified Navigation Structure

### Top Navigation Bar (Primary Navigation)
**Purpose**: Main system access points, visible to all roles (with role-based visibility)

**Structure**:
```
[Logo] [Team Switcher] [Dashboard] [Roster] [Schedule] [Messages] [Documents] [Inventory] [Settings] [Admin*] [User Controls]
```

**Navigation Items** (role-filtered):
1. **Dashboard** - All roles
   - Main landing page with calendar, updates, announcements
   
2. **Roster** - All roles (view-only for players/parents)
   - Roster management
   - Depth Charts (football only, integrated as tab)
   
3. **Schedule** - All roles
   - Full calendar view
   - Event management
   
4. **Messages** - All roles
   - Team messaging
   - Thread management
   
5. **Documents** - All roles (permission-scoped)
   - Playbooks, installs, resources
   
6. **Inventory** - Head Coach, Assistant Coaches only
   - Equipment tracking
   
7. **Settings** - Head Coach only
   - Team settings, staff management
   
8. **Admin** - Platform Owner only
   - Program management
   - User management
   - Message viewing (disputes)
   - Audit logs
   - Impersonation

### Sidebar (Quick Actions)
**Purpose**: Secondary navigation, contextual actions, less frequently used features

**Keep in Sidebar**:
- Announcements (also on dashboard)
- Payments/Collections (financial, less frequent)
- Invites (Head Coach only, occasional use)
- AI Assistant (widget, not a page)

### Layout Consistency

#### Standard Page Layout
All dashboard pages should follow this structure:
```
[Top Navigation Bar]
[Sidebar (Quick Actions)]
[Main Content Area]
  - Page Header (h1 + description)
  - Page Content (system-specific)
[AI Widget (floating)]
```

#### Page Header Template
```tsx
<div className="mb-8">
  <h1 className="text-3xl font-bold mb-2">Page Title</h1>
  <p className="text-gray-600">Page description</p>
</div>
```

## Role-Based Visibility Rules

### Navigation Visibility (UI Level Only)
- **Hide** items user cannot access (don't show, don't disable)
- **Show** items user can view (even if read-only)
- **Respect** backend permissions (UI doesn't override)

### Role-Specific Navigation

**HEAD_COACH**:
- All navigation items except Admin
- Full access to all systems

**ASSISTANT_COACH**:
- Dashboard, Roster, Schedule, Messages, Documents, Inventory
- No Settings, no Admin
- Scoped access within systems

**PLAYER**:
- Dashboard, Roster (view), Schedule (view), Messages, Documents (view)
- No Inventory, no Settings, no Admin

**PARENT**:
- Dashboard, Roster (view child only), Schedule (view), Messages (limited)
- No Inventory, no Documents, no Settings, no Admin

**PLATFORM_OWNER**:
- All navigation items
- Admin section with:
  - Programs
  - Users
  - Messages (dispute resolution)
  - Audit Logs
  - Impersonation

## System Integration Points

### Depth Charts
- **Current**: Tab within Roster page
- **Proposed**: Keep as tab, but make it more prominent
- Add visual indicator when depth chart tab is available (football teams)
- Ensure "Depth Chart" label is clear in roster page

### Calendar Integration
- Dashboard shows calendar widget (primary focus per spec)
- Schedule page shows full calendar view
- Both use same calendar component, different views

### AI Assistant
- Floating widget (existing implementation)
- Available on all pages
- Respects role permissions and billing status

### Platform Owner Admin
- New admin section in top nav (Platform Owner only)
- Admin dashboard with:
  - Program list
  - User management
  - Message search/viewing
  - Audit log viewer
  - Impersonation controls

## Implementation Steps

1. ✅ Create UI map/layout proposal (this document)
2. Update DashboardNav component to include all systems
3. Update QuickActionsSidebar to remove duplicates from top nav
4. Ensure consistent page headers across all pages
5. Add Platform Owner admin UI (pages only, no backend changes)
6. Verify role-based visibility works correctly
7. Test navigation flow across all roles

## Constraints

- **No backend changes**: Only UI/layout modifications
- **No permission logic changes**: Respect existing permissions
- **No feature invention**: Only integrate existing systems
- **Consistent layout**: All pages follow same structure
- **Role-based hiding**: Hide, don't disable

## Success Criteria

- [ ] All systems accessible via clear navigation
- [ ] Consistent layout across all pages
- [ ] Role-based visibility working correctly
- [ ] Depth charts clearly accessible
- [ ] Platform Owner has admin UI access
- [ ] Navigation feels unified, not fragmented
- [ ] All systems feel part of one application
