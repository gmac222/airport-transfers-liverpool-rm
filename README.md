# RM Transfers - System Architecture

This document outlines the technical architecture and automation workflows for the RM Transfers (Airport Transfers Liverpool) booking system.

## 🏗️ Core Tech Stack

- **Frontend & Hosting:** React (via raw Babel/JSX), hosted on **Vercel** (`airporttaxitransfersliverpool.co.uk`).
- **Database / Backend:** **Airtable** (Base: `Airport Transfers Liverpool`).
- **Automation Engine:** **n8n** (Cloud-hosted).
- **SMS Provider:** **ClickSend**.
- **Email Provider:** **Resend**.

---

## 🗄️ Airtable Structure

The Airtable base acts as the central source of truth for the entire application. It contains two primary tables:

### 1. `Bookings` Table (`tblAIQuXsh9MPtsSC`)
Stores all booking requests submitted by customers.
**Key Fields:**
- `Booking Ref` (Auto-generated unique ID)
- `Customer Name`, `Customer Phone`, `Customer Email`
- `Outbound Date`, `Outbound Time`, `Home Address`, `Airport`
- `Driver Name`, `Driver Phone` (Populated when a driver is assigned)
- `Total Price`, `Trip Type`

### 2. `Admins` Table
Stores login credentials for the Operator Dashboard.
**Key Fields:**
- `Name` (Username)
- `Password`

### 3. `Drivers` Table (`tblgM0WSDVJUbbjS2`)
Stores the list of available drivers for dispatch.
**Key Fields:**
- `Name`
- `Phone`

---

## ⚙️ Automation Workflows (n8n)

The system relies on three distinct n8n workflows to handle communications seamlessly without blocking the frontend.

### Workflow 1: Initial Booking Webhook
**Trigger:** Customer submits the form on `/#book`. Vercel `api/booking.js` creates the Airtable record, then POSTs to this webhook.
**Actions:**
1. **Operator Alert (SMS):** Uses ClickSend to text the main operator that a new booking has arrived.
2. **Customer Acknowledgment (SMS):** Uses ClickSend to text the customer: *"Hi [Name], your booking has been received. We will confirm shortly."*
3. **Customer Acknowledgment (Email):** Uses Resend to email a branded HTML receipt to the customer containing their trip summary and a link to their live portal.

### Workflow 2: Operator Accepts Booking
**Trigger:** Operator selects a driver and clicks "Accept" in the `admin.jsx` dashboard.
**Actions:**
1. **Driver Dispatch (SMS):** Uses ClickSend to text the assigned driver with job details (Pickup time, address, ref).
2. **Customer Confirmation (SMS):** Uses ClickSend to text the customer that their booking is confirmed, providing the driver's name and emergency contact number.
3. **Customer Confirmation (Email):** Uses Resend to email a branded HTML "Driver Assigned" notification to the customer.

### Workflow 3: Daily 24h Reminders
**Trigger:** Scheduled Cron Job (Runs daily at 9:00 AM).
**Actions:**
1. **Query Airtable:** Finds all bookings where the `Outbound Date` is exactly 1 day away (tomorrow) AND a driver is assigned.
2. **Driver Reminder (SMS):** Texts the driver a reminder of tomorrow's job. This text includes a unique, secure link to the Driver Portal (`driver-action.html?ref=...`).
3. **Customer Reminder (Email):** Emails the customer a branded "Your trip is tomorrow!" reminder confirming their pickup time.

---

## 📱 Portals & Interfaces

### 1. The Customer Portal (`portal.html?ref=...`)
A read-only live tracking page for customers. It queries `api/booking.js` using their unique `Booking Ref` and displays the current status (Pending / Driver Assigned) alongside their full itinerary and assigned driver details.

### 2. The Operator Dashboard (`admin.html`)
The main dispatch hub. Protected by a simple auth layer (checks the `Admins` Airtable).
- Sorts jobs by most recently submitted.
- Allows operators to assign drivers to jobs, triggering **Workflow 2**.
- Includes a "+ New Manual Booking" button that redirects to the main website booking form to manually input jobs and trigger **Workflow 1**.

### 3. The Driver Portal (`driver-action.html?ref=...`)
A micro-portal accessed exclusively via the link in the 24-hour reminder SMS. 
- Features a single "I am on the way!" button.
- When tapped, it hits `api/driver-action.js`, which instantly triggers a ClickSend SMS to the customer letting them know the driver has departed.

---

## 🔒 Environment Variables (Vercel)
- `AIRTABLE_PERSONAL_ACCESS_TOKEN` / `AIRTABLE_API_KEY`: Used by API routes to read/write to the database.
