### 1. Schedules Table (From `SchedulesTable.tsx`)

#### Functionalities:

1. **View Schedules**
   - Viewing all schedules in a tabulated format.
   - Viewing individual schedule details through a detailed view (assumed functionality based on your `MuiLink` usage).

2. **Sorting**
   - Sorting the table by different columns such as "Next scheduled run", "Last run", etc.

3. **Row Selection**
   - Selecting individual rows using checkboxes.
   - Selecting all rows using the header checkbox.

4. **Multi-select Actions**
   - Editing data (although it seems the functionality is not implemented in the code snippet).
   - Unscheduling selected schedules (not implemented in the code snippet).
   - Running selected schedules.
   - Deleting selected schedules.

5. **Pagination**
   - Changing the number of rows per page.
   - Navigating through different pages.

6. **Filtering**
   - Filtering the table using the filter button (assumed functionality, the button is present but the functionality is not detailed in the code snippet).

#### Playwright Tests (To-Do List):

1. **View Schedules**
   - Verify that all schedules are being displayed correctly.
   - Verify that individual schedule details can be viewed.

2. **Sorting**
   - Verify the sorting functionality for each column.

3. **Row Selection**
   - Verify the individual row selection functionality.
   - Verify the "select all" functionality.

4. **Multi-select Actions**
   - Verify the edit data functionality (once implemented).
   - Verify the unschedule functionality (once implemented).
   - Verify the run functionality.
   - Verify the delete functionality.

5. **Pagination**
   - Verify that pagination controls are working correctly.
   - Verify that changing the number of rows per page functions correctly.

6. **Filtering**
   - Verify the filter functionality (once implemented).

### 2. Runs Table (Assumed based on previous interaction)

#### Functionalities:

1. **View Runs**
   - Viewing all runs in a tabulated format.
   - Viewing individual run details through a detailed view (assuming a similar setup to the Schedules Table).

2. **Expandable Rows**
   - Viewing detailed data of a run by expanding the row.

#### Playwright Tests (To-Do List):

1. **View Runs**
   - Verify that all runs are being displayed correctly.
   - Verify that individual run details can be viewed.

2. **Expandable Rows**
   - Verify the functionality of expandable rows to view more detailed data.

### 3. Cards on Details Routes (Assumed based on your statement)

#### Functionalities:

1. **Viewing Card Details**
   - Viewing detailed information displayed on each card.

2. **Updating Information**
   - Updating the information through the update buttons present on each card.

#### Playwright Tests (To-Do List):

1. **Viewing Card Details**
   - Verify that the card details are displayed correctly.

2. **Updating Information**
   - Verify the update functionality for each card through the update buttons.

### General Testing:

1. **Routing**
   - Ensure that the routing within the app is working correctly, and users are navigated to the correct pages.
   
2. **Responsive Design**
   - Test the responsive design of the app to ensure that it functions correctly on various device sizes.

3. **Error Handling**
   - Test the app's error handling capabilities to ensure that it can gracefully handle errors and display appropriate error messages.
