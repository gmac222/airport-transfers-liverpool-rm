# RM Transfers: The Complete Operating Guide

Welcome to your new fully-automated booking and dispatch system! This guide explains exactly what happens when a customer books, what you need to do, and how the automation handles the rest.

---

## 1. When a Customer Books a Trip
Whether a customer books through your website, or you manually book it for them using the gold **"+ New Manual Booking"** button in your dashboard, the exact same automated process instantly kicks off:

*   **You get a text:** Your operator phone receives an instant SMS letting you know a new job has arrived.
*   **Customer gets a text:** *"Hi [Name], your booking has been received. We will confirm shortly."*
*   **Customer gets an email:** A professional, branded email containing their trip itinerary and a link to their live "Booking Portal". At this stage, the portal will show their job as **"Pending"**.

## 2. When You Assign a Driver (The Dashboard)
When you are ready to confirm the job, open your **Operator Dispatch Dashboard**.

1. The newest jobs are always pushed to the very top of the list.
2. Under the pending job, select a driver from the dropdown menu (e.g., Roy).
3. Click the **"Accept & Assign"** button.

*Boom. The system instantly takes over and fires off three things at the exact same time:*
*   **Driver gets a text:** *"New Job Assigned! Ref: [Ref]. Pickup: [Address] at [Time] on [Date]."*
*   **Customer gets a text:** *"Great news! Your booking is confirmed. Your driver will be Roy (Phone: 07... for emergencies)."*
*   **Customer gets an email:** A branded "Driver Assigned" email giving them the driver's name and contact details. Their live portal updates to **"Confirmed"**.

## 3. The Day Before the Trip (24h Reminders)
You don't need to remember to remind anyone! **Every morning at 9:00 AM**, the system wakes up, checks your database for any jobs happening the next day, and does the following:

*   **Customer gets an email:** *"Your Trip is Tomorrow!"*
*   **Driver gets a text:** *"Reminder: You have a trip tomorrow at [Time] from [Address]."*

**The Magic Driver Link:**
At the end of the driver's reminder text, there is a special blue web link. That link is just for them, and just for that specific job. 

## 4. On the Day of the Trip ("I am on the way!")
When the driver gets in their car and starts driving to pick up the customer, they do **not** need to text the customer manually.

1. The driver opens their text messages and taps the special blue link from their reminder text.
2. A beautiful, simple screen opens on their phone with a massive gold button that says **"I am on the way!"**
3. The driver taps it.
4. **Customer gets a text instantly:** *"Hi [Name], your RM Transfers driver (Roy) is on the way to pick you up! See you soon."*

---

## 📝 Quick Day-to-Day Rules

*   **How do I edit a customer's phone number or pickup time?**
    Do not do this in the dashboard. Open your **Airtable** database. Airtable is your "Source of Truth". Simply click on the customer's cell and change the time or number. Everything else will automatically update based on what you put in Airtable.
*   **How do I manually input a booking from a phone call?**
    Go to your Operator Dashboard and click the gold **"+ New Manual Booking"** button at the top right. Fill out the form as if you were the customer. This ensures they get all the automated texts and emails just like everyone else!
*   **How do I add a new driver?**
    In your Operator Dashboard, use the "Add New Driver" section on the left side. Type their name and phone number. They will instantly appear in the dropdown list for future jobs!
