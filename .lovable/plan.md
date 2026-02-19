

# Services Management System (Admin + Frontend)

## Overview

Build a dynamic services management system replacing the current hardcoded services page. Admins can create, edit, delete, reorder, and toggle services. The public `/services` page fetches from the database.

## Database

### Table: `services`

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| title | text | NOT NULL |
| slug | text | NOT NULL, UNIQUE |
| short_description | text | NOT NULL |
| full_description | text | nullable |
| icon_name | text | default 'Camera' |
| category | text | default 'wedding' |
| price | text | nullable (e.g. "From $3,500") |
| show_price | boolean | true |
| show_book_button | boolean | false |
| book_button_text | text | 'Book Now' |
| estimated_delivery | text | nullable |
| is_active | boolean | true |
| display_order | integer | 0 |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### Table: `service_features`

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| service_id | uuid | FK -> services.id ON DELETE CASCADE |
| feature_text | text | NOT NULL |
| display_order | integer | 0 |

### RLS Policies

- **Public SELECT** on both tables: `is_active = true` (services) / join to active service (features)
- **ALL for staff**: using `is_staff(auth.uid())`

### Seed Data

Insert the 6 existing hardcoded services into the new tables so nothing is lost.

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/pages/admin/ServicesManagement.tsx` | Admin page listing all services with edit/delete/reorder/toggle |
| `src/components/admin/ServiceFormDialog.tsx` | Create/Edit dialog with all form fields + feature points management |

### Modified Files

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Add "Services" nav item with `Briefcase` icon |
| `src/App.tsx` | Add route `/admin/services` |
| `src/pages/Services.tsx` | Replace hardcoded array with database fetch; render dynamically with price/book button/contact logic |

## Admin Page (`/admin/services`)

- Card grid showing all services (active and inactive)
- Each card: icon, title, category badge, price (if shown), active/inactive badge
- Actions: Edit, Delete, Toggle Active, Move Up/Down (reorder)
- "Create New Service" button opens form dialog
- Delete with confirmation dialog

## Service Form Dialog

- Title input (auto-generates slug on create)
- Short Description textarea
- Full Description textarea (optional)
- Icon selector dropdown (Camera, Video, Heart, Star, Users, Clock, Briefcase, etc.)
- Category selector (Wedding, Corporate, Fashion, Event, Other)
- Estimated Delivery input (optional)
- Toggle: Show Price -- if on, show Price input
- Toggle: Show Book Button -- if on, show Book Button Text input
- Toggle: Is Active
- Feature Points section: list of text inputs with add/remove/reorder

## Frontend Services Page Logic

```text
if show_price = true  --> display price
if show_book_button = true  --> display styled button linking to /booking?service={slug}
if both false  --> display "Contact for Pricing" linking to /contact
if both true  --> display both price and button
```

## Technical Details

- Use `supabase.from('services')` and `supabase.from('service_features')` directly (no edge function needed -- RLS handles access)
- Slug auto-generated from title: lowercase, replace spaces with hyphens, remove special chars
- Icon rendered dynamically using a map of lucide icon names to components
- `updated_at` trigger reused from existing `update_updated_at_column()` function
- Service features fetched with a single query joining on service_id

