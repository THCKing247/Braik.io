-- Roster Template: Customizable template for roster print/email
-- Allows coaches to customize the roster format

-- Add roster_template column to teams table
alter table public.teams add column if not exists roster_template jsonb default '{
  "header": {
    "showYear": true,
    "showSchoolName": true,
    "showTeamName": true,
    "yearLabel": "Year",
    "schoolNameLabel": "School",
    "teamNameLabel": "Team"
  },
  "body": {
    "showJerseyNumber": true,
    "showPlayerName": true,
    "showGrade": true,
    "jerseyNumberLabel": "Number",
    "playerNameLabel": "Name",
    "gradeLabel": "Grade",
    "sortBy": "jerseyNumber"
  },
  "footer": {
    "showGeneratedDate": true,
    "customText": ""
  }
}'::jsonb;

-- Add index for roster_template queries (if needed in future)
create index if not exists idx_teams_roster_template on public.teams(id) where roster_template is not null;
