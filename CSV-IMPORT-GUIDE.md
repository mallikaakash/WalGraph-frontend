# CSV Import Guide

This directory contains sample CSV files that demonstrate different ways to import data into your WalGraph editor.

## Sample Files

### 1. `sample-data.csv` - People/Employees
Contains information about people with the following columns:
- `id` - Unique identifier
- `name` - Person's full name
- `type` - Entity type (Person)
- `age` - Age in years
- `role` - Job title/role
- `company` - Company name
- `department` - Department/team
- `location` - Work location
- `salary` - Annual salary
- `experience` - Years of experience
- `skills` - Technical skills (space-separated)

### 2. `sample-companies.csv` - Companies and Projects
Contains information about companies and projects:
- `id` - Unique identifier (C1, C2... for companies, P1, P2... for projects)
- `name` - Company/project name
- `type` - Entity type (Company or Project)
- `industry` - Industry/category
- `founded` - Year founded or project start
- `employees` - Number of employees or project status
- `revenue` - Annual revenue or priority level
- `location` - Location or owning company
- `website` - Website URL
- `description` - Brief description

### 3. `sample-relationships.csv` - Relationships
Contains relationships between entities:
- `source_id` - Source entity ID
- `target_id` - Target entity ID
- `relationship_type` - Type of relationship (WORKS_AT, WORKS_ON, MANAGES, MENTORS)
- `since` - Start year of relationship
- `role` - Role in the relationship
- `status` - Current status
- `notes` - Additional information

## How to Import

### Method 1: Import Nodes Only
1. Go to the **Import** tab in WalGraph editor
2. Upload `sample-data.csv`
3. Configure:
   - **Node Type Column**: `type`
   - **Node ID Column**: `id`
   - **Relationship Mode**: `none`
4. Click **Import**

### Method 2: Import with Sequential Relationships
1. Upload `sample-data.csv`
2. Configure:
   - **Node Type Column**: `type`
   - **Node ID Column**: `id`
   - **Relationship Mode**: `sequential`
   - **Relationship Type**: `KNOWS` or `CONNECTED_TO`
3. This will create relationships between consecutive rows

### Method 3: Import with Property-based Relationships
1. Upload `sample-relationships.csv`
2. Configure:
   - **Node Type Column**: `relationship_type`
   - **Node ID Column**: `source_id`
   - **Relationship Mode**: `properties`
   - **Source Column**: `source_id`
   - **Target Column**: `target_id`
   - **Relationship Type**: Use the `relationship_type` column value

### Method 4: Multi-step Import (Recommended)
1. **Step 1**: Import people from `sample-data.csv`
2. **Step 2**: Import companies/projects from `sample-companies.csv`
3. **Step 3**: Import relationships from `sample-relationships.csv`

## Expected Results

After importing all data, you should have:
- **10 Person nodes** (employees)
- **9 Company/Project nodes** (4 companies + 5 projects)
- **22 Relationships** (work relationships, project assignments, management hierarchy)

## Graph Structure

The resulting graph will show:
- **TechCorp** as the main company with multiple employees
- **Project assignments** showing who works on what
- **Management hierarchy** (Frank manages Alice, Charlie, and Grace)
- **Mentoring relationships** (Alice mentors Grace, etc.)
- **Cross-company connections** through the different organizations

## Tips

- Always check the **Import Preview** before importing
- Use meaningful relationship types for better visualization
- The `id` column should contain unique identifiers
- Mixed data types (strings, numbers) are automatically detected
- You can import the same file multiple times to test different configurations 