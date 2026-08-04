# Evacuation Monitoring - 4-Step Modal Workflow

## Overview
The evacuation monitoring form has been restructured into 4 separate modals to provide a cleaner, step-by-step workflow for managing evacuation centers.

## Workflow Steps

### Step 1: Add New Center (Part 1)
**Trigger:** Click "+ Add New Center" button in the main list

**Modal:** Part 1 - Camp Management Structure

**Fields:**
- Name of Evacuation Center *
- Year Established
- Capacity *
- Address *
- Latitude / Longitude
- Floor Area / Lot Area
- Type of Evacuation Center *
- Custom Type (if "Others" selected)

**Action:** Saves the center to the database and closes modal. Center appears in the list with 3 action buttons.

---

### Step 2: Add Personnel (Part 2)
**Trigger:** Click "Personnel" button next to a center in the table

**Modal:** Part 2 - Camp Management Personnel Directory

**Features:**
- Pre-populated table with 13 fixed roles (LGU Camp Coordinator, EC Camp Manager, etc.)
- Add custom roles button
- Each row has fields for first name, middle name, last name, suffix, designation, office, contact

**Action:** Saves personnel directory to the center and closes modal.

---

### Step 3: Evaluate Facilities (Part 3)
**Trigger:** Click "Evaluate" button next to a center in the table

**Modal:** Part 3 - Standard Camp Facilities

**Fields:** 20 facility items with Yes/No selects and detail fields:
1. Information Board
2. Shelter and Accommodation
3. Camp Management Desk
4. Community Kitchen
5. Storage Area
6. Water Facility
7. Latrines / Toilets
8. Handwashing Facility
9. Laundry Space
10. Health Station
11. Breastfeeding Room
12. Couple's Room
13. Child-Friendly Space
14. Women-Friendly Space
15. Prayer Room
16. Ramp
17. Animals Area
18. Solid Waste Management
19. Power Supply
20. Others & Structural Integrity

**Action:** Saves facilities checklist, closes Part 3 modal, and **automatically opens Part 4 modal**.

---

### Step 4: Finalize (Part 4) - AUTO-OPENS after Part 3
**Trigger:** Automatically opens after saving Part 3

**Modal:** Part 4 - Contingency Plan & Approval

**Features:**
- Auto-generated contingency plan based on "No" answers in Part 3
- "Regenerate Plan" button to update based on current data
- Manual editing allowed
- Prepared By fields (first, middle, last name, suffix, designation)
- Approved By fields (first, middle, last name, suffix, designation)

**Note:** Camp Layout file upload has been **removed** per your request.

**Action:** Saves contingency plan and approval sign-off. Finalizes the center.

---

## Action Buttons in Center List

Each center row has 3 buttons:

1. **Edit** (pencil icon) → Opens Part 1 modal with center data pre-filled
2. **Personnel** (users icon) → Opens Part 2 modal to manage personnel
3. **Evaluate** (clipboard-check icon) → Opens Part 3 modal to evaluate facilities → Auto-opens Part 4 on save

---

## Technical Changes

### HTML Structure
- 4 separate modal overlays: `modal-part1-overlay`, `modal-part2-overlay`, `modal-part3-overlay`, `modal-part4-overlay`
- Each modal is independent and can be opened/closed separately
- Modal helpers: `openModal(id)`, `closeModal(id)`, `closeModalOutside(event, id)`

### JavaScript Functions
- `openPart1Modal(centerId)` - Add new or edit center
- `openPart2Modal(centerId)` - Manage personnel
- `openPart3Modal(centerId)` - Evaluate facilities
- `openPart4Modal(centerId)` - Finalize with contingency & approval (auto-opens after Part 3)
- `submitPart1()`, `submitPart2()`, `submitPart3()`, `submitPart4()` - Save handlers

### Data Flow
1. Part 1 creates/updates basic center info
2. Part 2 patches personnel_directory
3. Part 3 patches facilities_checklist → triggers Part 4
4. Part 4 patches contingency_plan, prepared_by, approved_by

All parts use PATCH requests to update the center incrementally.

---

## User Experience

1. User clicks "+ Add New Center"
2. Fills Part 1 (basic info) → Save
3. Center appears in list
4. User clicks "Personnel" → Fills Part 2 → Save
5. User clicks "Evaluate" → Fills Part 3 → Save
6. Part 4 **auto-opens** with generated contingency plan
7. User reviews/edits plan, fills approval info → Save & Finalize

**Result:** Clean, progressive workflow that doesn't overwhelm users with a massive single form.
