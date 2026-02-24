

# Quotation Management System

## Overview

Build a complete quotation system allowing admins to create, send, and track quotations. Clients receive professional branded emails and can view quotations via a secure public link with PDF download.

## Database

### Table: `quotations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| quotation_number | text | UNIQUE, NOT NULL, auto-generated (AJ-2026-0001) |
| client_name | text | NOT NULL |
| client_email | text | NOT NULL |
| client_phone | text | nullable |
| event_type | text | nullable |
| event_date | date | nullable |
| subtotal | numeric | NOT NULL, default 0 |
| tax_percentage | numeric | NOT NULL, default 0 |
| discount_amount | numeric | NOT NULL, default 0 |
| total_amount | numeric | NOT NULL, default 0 |
| notes | text | nullable (terms, payment info) |
| status | text | NOT NULL, default 'draft' (draft/sent/viewed/accepted/rejected) |
| booking_id | uuid | nullable FK to bookings.id |
| valid_until | date | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### Table: `quotation_items`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| quotation_id | uuid | FK to quotations.id ON DELETE CASCADE |
| item_name | text | NOT NULL |
| description | text | nullable |
| quantity | integer | NOT NULL, default 1 |
| price | numeric | NOT NULL, default 0 |
| total | numeric | NOT NULL, default 0 |
| display_order | integer | default 0 |

### Auto-increment quotation number

A database function `generate_quotation_number()` will be created:
- Format: `AJ-YYYY-NNNN` (e.g., AJ-2026-0001)
- Uses a sequence or counts existing quotations for the current year
- Called via trigger on INSERT

### RLS Policies

- Staff can manage all quotations and items (using `is_staff()`)
- Public/anonymous: no direct access (quotation viewing goes through an edge function)

### Trigger

- `update_updated_at` trigger on quotations table

## Edge Function: `send-quotation`

New edge function at `supabase/functions/send-quotation/index.ts`:

- Accepts `{ quotationId: string }` 
- Fetches quotation + items from DB using service role
- Generates a branded HTML email matching existing email style (dark theme with gold accents, studio logo, footer)
- Includes: client name, event details, itemized breakdown table, subtotal/tax/discount/total, notes, and a "View Quotation" button linking to `/quotation/{quotation_number}`
- Sends via Resend (reuses existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` secrets)
- Updates quotation status to `sent`
- Logs to `email_logs` table

## Edge Function: `get-quotation`

New edge function at `supabase/functions/get-quotation/index.ts`:

- Public endpoint (no auth required)
- Accepts `{ quotation_number: string }`
- Returns quotation data + items for the public view page
- Updates status to `viewed` if currently `sent`

## Edge Function: `update-quotation-status`

New edge function at `supabase/functions/update-quotation-status/index.ts`:

- Public endpoint for accept/reject actions
- Accepts `{ quotation_number: string, action: 'accept' | 'reject' }`
- Updates status accordingly

## New Frontend Pages

### 1. Admin Quotations List (`src/pages/admin/Quotations.tsx`)

Route: `/admin/quotations`

- Table with columns: Quotation Number, Client Name, Event, Event Date, Total Amount, Status (color-coded badge), Created Date, Actions
- Search by client name/email/quotation number
- Filter by status
- "Create New Quotation" button
- Row actions: View, Edit, Send (email), Delete
- Follows existing admin page patterns (like Bookings.tsx)

### 2. Admin Quotation Form (`src/components/admin/QuotationFormDialog.tsx`)

Full-page dialog or large dialog with sections:

**Client Section:**
- Client Name, Email, Phone inputs
- "Fill from Booking" button -- opens a dropdown/select of bookings to auto-fill client data

**Event Section:**
- Event Type, Event Date

**Items Section (dynamic):**
- Add/remove item rows
- Each row: Item Name, Description, Quantity, Price, auto-calculated Total
- Add Item button

**Pricing Section (auto-calculated):**
- Subtotal (sum of item totals)
- Tax % input with calculated tax amount shown
- Discount amount input
- Final Total (auto-calculated: subtotal + tax - discount)

**Notes Section:**
- Textarea for terms, payment details, advance info

**Validity:**
- Valid Until date picker

### 3. Public Quotation View (`src/pages/QuotationView.tsx`)

Route: `/quotation/:quotationNumber`

- Fetches quotation via `get-quotation` edge function
- Professional branded layout showing:
  - Studio logo and details
  - Client info
  - Event details
  - Itemized table
  - Pricing breakdown
  - Notes/terms
  - Accept / Reject buttons (if status is sent or viewed)
- PDF download button using jspdf (already installed)

### 4. Booking Integration

In `src/pages/admin/Bookings.tsx`:
- Add "Create Quotation" option to the dropdown menu for each booking
- Clicking navigates to `/admin/quotations?fromBooking={bookingId}` or opens the form dialog pre-filled

## Admin Sidebar

Add "Quotations" nav item with `FileText` icon to `AdminLayout.tsx`, positioned after Services.

## Routing

Add to `App.tsx`:
- `/admin/quotations` -- AdminQuotations
- `/quotation/:quotationNumber` -- QuotationView (public)

## Files Summary

| File | Action |
|------|--------|
| Database migration | Create tables, function, trigger, RLS |
| `supabase/functions/send-quotation/index.ts` | Create -- send quotation email |
| `supabase/functions/get-quotation/index.ts` | Create -- public quotation fetch |
| `supabase/functions/update-quotation-status/index.ts` | Create -- accept/reject |
| `src/pages/admin/Quotations.tsx` | Create -- admin list page |
| `src/components/admin/QuotationFormDialog.tsx` | Create -- create/edit form |
| `src/pages/QuotationView.tsx` | Create -- public view + PDF download |
| `src/components/admin/AdminLayout.tsx` | Add nav item |
| `src/pages/admin/Bookings.tsx` | Add "Create Quotation" action |
| `src/App.tsx` | Add routes |
| `supabase/config.toml` | Add verify_jwt = false for public edge functions |

