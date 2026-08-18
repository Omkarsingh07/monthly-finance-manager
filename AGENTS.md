# AGENTS.md

# CRITICAL DATA SAFETY RULE — NEVER DELETE OR RESET USER DATA

This is a production personal finance application. Google Sheets contains REAL USER FINANCIAL DATA. Existing user data is considered PERSISTENT PRODUCTION DATA.

## ABSOLUTE RULE

NEVER delete, clear, reset, overwrite, recreate, truncate, or initialize existing user data as part of:
- UI changes
- UX changes
- Bug fixes
- Performance optimization
- Authentication changes
- CORS changes
- API changes
- Refactoring
- Component changes
- Frontend redesign
- Backend restructuring
- Deployment
- Testing
- Dependency upgrades
- TypeScript fixes
- Calculation fixes

Existing data MUST survive all code changes and deployments. The user must NEVER be required to enter their financial data again.

## GOOGLE SHEETS IS PRODUCTION DATA

The Google Spreadsheet is the application's persistent source of truth.
Treat these sheets as production data:
- `Settings`
- `InvestmentPlan`
- `MonthlyInvestments`
- `PlanHistory`
- Any future production data sheets

**Strict Rules:**
- DO NOT clear these sheets automatically.
- DO NOT recreate them if they already exist.
- DO NOT overwrite existing rows with sample/canonical/test data.
- DO NOT run destructive initialization on application startup.

## SCHEMA INITIALIZATION

If the application starts and a required sheet/tab does not exist:
- It may create the missing tab and headers.
- **BUT**: If the tab already exists, DO NOTHING destructive. Never clear existing rows just because the application version changed. Headers may only be migrated using a safe, non-destructive migration strategy.

## NO TEST DATA IN PRODUCTION

Integration tests MUST NOT use the real production spreadsheet in a destructive way.
- Never call `clearDataRows()`, delete all rows, reset spreadsheet, restore canonical data, or truncate sheet against production data.
- If integration tests require data, use a dedicated test spreadsheet OR isolated test records with unique IDs and guaranteed cleanup of ONLY those records.

## NO "CANONICAL DATA RESTORATION"

NEVER execute logic such as:
- "restore canonical plan"
- "reset to default plan"
- "initialize sample investments"
- "restore test data"
on the user's production spreadsheet.
Defaults may ONLY be used when the database/sheet is genuinely empty and the user explicitly chooses to create a plan.

## UPDATES MUST BE SURGICAL

- Changing one investment: Update ONLY that investment's row.
- Changing one monthly investment: Update ONLY `planInvestmentId + year + month`.
- Changing settings: Update ONLY the relevant Settings key.
- Changing plan: Create a new plan version where appropriate.
- Never rewrite the entire spreadsheet unnecessarily.

## PLAN HISTORY & MONTHLY INVESTMENTS

- Investment plan changes must preserve historical plans. Never rewrite historical months.
- Monthly investment records are historical financial records. Never delete or rewrite historical records because UI or calculation logic changed.
- A legitimate user edit updates only the specific record.

## DEPLOYMENT & MIGRATION SAFETY

- Deployment must NEVER modify production Google Sheet data.
- If a future schema change is required:
  1. Detect existing schema.
  2. Preserve all existing data.
  3. Non-destructive migration only.
  4. Backup data before modification.
  5. Verify row counts and records before/after.
- Before modifying any code, verify: "Can this change modify existing user data?" If YES, redesign to be non-destructive.
