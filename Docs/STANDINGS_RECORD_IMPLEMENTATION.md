# Standings & Record Integration Implementation

## Overview

This document describes the implementation of the standings/record system for Braik, providing a reliable record/standings display with manual fallback as specified in the BRAIK_MASTER_INTENT.md.

## Implementation Summary

### ✅ Completed Features

1. **Dashboard Header Display**
   - Updated `UnifiedTeamHeader` component to display:
     - Division (e.g., "5A", "Division I")
     - Conference (e.g., "Big 12", "Metro Conference")
     - Overall record (wins-losses)
     - Conference record (wins-losses)
     - Playoff status
   - Graceful degradation: Division/conference only display if data exists

2. **Manual Entry/Edit by Head Coach**
   - New API endpoint: `PATCH /api/teams/[teamId]/season`
     - Allows Head Coach to update division, conference, and playoff ruleset
     - Automatically creates season record if none exists
     - Includes audit logging
   - Settings UI: Added "Division & Standing" section in Season Settings
     - Head Coach can manually enter/edit division and conference
     - Clear instructions and helpful placeholders

3. **Data Flow**
   - Records are calculated from confirmed `Game` entries (existing functionality)
   - Division/conference stored in `Season` model
   - Dashboard fetches current season and passes data to header
   - All data gracefully handles missing values

### Database Schema

The existing `Season` model already supports:
- `division` (String?) - e.g., "5A", "Division I"
- `conference` (String?) - e.g., "Big 12", "SEC"
- `playoffRuleset` (String?) - Playoff qualification rules

No schema changes were required.

## Integration Approach (Future)

### Option 1: Official Sports APIs (Recommended)

**High School:**
- MaxPreps API (if available)
- State athletic association APIs (varies by state)
- NFHS Network API (limited availability)

**College:**
- NCAA API (limited public access)
- Conference-specific APIs (varies)

**Implementation:**
- Create optional connector service
- Store API credentials in team settings (encrypted)
- Sync on-demand or scheduled basis
- Manual override always available

**Pros:**
- Automated updates
- Official data source
- Reduces manual entry

**Cons:**
- API availability varies by level/state
- Requires API keys/credentials
- Rate limiting considerations
- May require scraping (terms of service dependent)

### Option 2: Web Scraping (Not Recommended)

**Approach:**
- Scrape public standings pages
- Parse HTML/JSON
- Store in database

**Pros:**
- No API keys needed
- Works with any public source

**Cons:**
- Violates many sites' terms of service
- Fragile (breaks when site changes)
- Legal/ethical concerns
- Maintenance burden

### Option 3: CSV/File Import

**Approach:**
- Head Coach uploads CSV file with standings
- Parse and import data
- One-time or recurring import

**Pros:**
- Simple implementation
- No external dependencies
- Works for any data source

**Cons:**
- Manual process
- Requires file format standardization

### Recommended Path Forward

1. **Phase 1 (Current):** Manual entry - ✅ Complete
2. **Phase 2 (Future):** Add CSV import option for bulk updates
3. **Phase 3 (Future):** Evaluate official API availability per state/level
4. **Phase 4 (Future):** Implement API connectors where available

## Files Modified

1. `components/unified-team-header.tsx`
   - Added division and conference display
   - Updated interface to include optional division/conference

2. `app/api/teams/[teamId]/season/route.ts` (NEW)
   - GET endpoint: Fetch current season data
   - PATCH endpoint: Update season division/conference (Head Coach only)

3. `components/settings-sections/season-settings.tsx`
   - Added "Division & Standing" card
   - Form inputs for division and conference
   - Loads existing data on mount

4. `app/dashboard/page.tsx`
   - Updated to pass division and conference to header component

## Usage

### For Head Coaches

1. Navigate to Settings → Season
2. Scroll to "Division & Standing" section
3. Enter division (e.g., "5A") and/or conference (e.g., "Big 12")
4. Click "Save Division & Standing"
5. Information appears on dashboard header

### Graceful Degradation

- If no season exists: Season is created automatically when first updated
- If division/conference is null: Fields don't display (no errors)
- If records are 0-0: Displays "0-0" with 0.0% win percentage
- All components handle missing data gracefully

## Constraints Respected

✅ No modification to core permissions, messaging, calendar, depth charts, billing, or AI
✅ Only Head Coach can edit division/standing
✅ Graceful degradation if data missing
✅ No blocking if standings unavailable
✅ No scraping or terms violations
✅ Manual fallback always available

## Testing Recommendations

1. Test with no season data (should create season)
2. Test with existing season data (should update)
3. Test with null division/conference (should not display)
4. Test Head Coach permissions (should work)
5. Test non-Head Coach access (should be denied)
6. Test dashboard display with various data combinations

## Future Enhancements

- [ ] CSV import for standings data
- [ ] Optional API connector framework
- [ ] Standing position tracking (e.g., "1st in Division")
- [ ] Historical standings view
- [ ] Playoff qualification calculator (using playoffRuleset)
