"""Generate a printable PDF flow diagram of the RM Transfers booking
system. Output: rm-transfers-booking-flow.pdf in the project root.

Updated May 2026 to reflect the full current system including:
Stripe Checkout, operator dispatch, driver portals, auto-assign,
full SMS/email chain, cron nudge, and review invites.

Three pages:
  1. End-to-end booking journey (swimlane diagram)
  2. Booking states & visibility reference
  3. Technology stack & automation summary
"""
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
import math

OUT = 'rm-transfers-booking-flow.pdf'
page_w, page_h = landscape(A3)

# Palette
NAVY = HexColor('#0B1E37')
NAVY_INK = HexColor('#0E2747')
AMBER = HexColor('#E6B24B')
AMBER_DEEP = HexColor('#C7932F')
CREAM = HexColor('#FAF7F2')
LINE = HexColor('#D7CFC0')
INK = HexColor('#1F2937')
MUTED = HexColor('#6B7280')
GREEN = HexColor('#10B981')
GREEN_BG = HexColor('#DCFCE7')
RED = HexColor('#DC2626')
RED_BG = HexColor('#FEE2E2')
BLUE = HexColor('#3B82F6')
BLUE_BG = HexColor('#DBEAFE')
YELLOW_BG = HexColor('#FEF3C7')
PURPLE = HexColor('#7C3AED')
PURPLE_BG = HexColor('#EDE9FE')
WHITE = HexColor('#FFFFFF')

c = canvas.Canvas(OUT, pagesize=(page_w, page_h))

# ── Helper: draw arrow ────────────────────────────────────────────
def arrow(x1, y1, x2, y2, color=AMBER_DEEP, label=None):
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    a_len = 3 * mm
    a_w = 1.6 * mm
    bx = x2 - a_len * math.cos(ang)
    by = y2 - a_len * math.sin(ang)
    p1 = (bx + a_w * math.sin(ang), by - a_w * math.cos(ang))
    p2 = (bx - a_w * math.sin(ang), by + a_w * math.cos(ang))
    c.setFillColor(color)
    p = c.beginPath()
    p.moveTo(x2, y2); p.lineTo(*p1); p.lineTo(*p2); p.close()
    c.drawPath(p, fill=1, stroke=0)
    if label:
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        c.setFont('Helvetica-Oblique', 7)
        c.setFillColor(MUTED)
        c.drawString(mx + 1 * mm, my + 1 * mm, label)


# ══════════════════════════════════════════════════════════════════
# PAGE 1 — End-to-end booking journey
# ══════════════════════════════════════════════════════════════════

# Title bar
c.setFillColor(NAVY)
c.rect(0, page_h - 28 * mm, page_w, 28 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 20)
c.drawString(20 * mm, page_h - 14 * mm,
             'RM Transfers — Complete Booking System Flow')
c.setFillColor(AMBER)
c.setFont('Helvetica', 10)
c.drawString(20 * mm, page_h - 21 * mm,
             'End-to-end from website booking through Stripe payment, '
             'operator dispatch, driver actions, to post-trip review. '
             'Updated May 2026.')

# Swimlanes
LANES = [
    ('Customer',  HexColor('#FFFBEB'), AMBER_DEEP),
    ('Admin',     HexColor('#EEF2FF'), HexColor('#4338CA')),
    ('Operator',  HexColor('#F0FDF4'), HexColor('#047857')),
    ('Driver',    HexColor('#FFF7ED'), HexColor('#C2410C')),
    ('System',    HexColor('#F3F4F6'), HexColor('#374151')),
]

content_top = page_h - 28 * mm - 3 * mm
content_bottom = 16 * mm
content_h = content_top - content_bottom
lane_h = content_h / len(LANES)
content_left = 20 * mm
content_right = page_w - 10 * mm
content_w = content_right - content_left

for i, (label, bg, fg) in enumerate(LANES):
    y = content_top - lane_h * (i + 1)
    c.setFillColor(bg)
    c.rect(content_left, y, content_w, lane_h, fill=1, stroke=0)
    c.setFillColor(fg)
    c.rect(content_left, y, 16 * mm, lane_h, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 9)
    c.saveState()
    c.translate(content_left + 8 * mm, y + lane_h / 2)
    c.rotate(90)
    c.drawCentredString(0, -3, label.upper())
    c.restoreState()

def lane_y(label):
    for i, (l, _, _) in enumerate(LANES):
        if l == label:
            return content_top - lane_h * i, content_top - lane_h * (i + 1)
    raise KeyError(label)

# Columns — 8 columns to fit the full flow
left_pad = content_left + 16 * mm + 3 * mm
right_edge = content_right - 3 * mm
columns = 8
col_gap = (right_edge - left_pad) / columns
col_x = [left_pad + col_gap * i for i in range(columns + 1)]
box_w = col_gap - 4 * mm
box_h = lane_h - 6 * mm

def draw_step(col_idx, lane, title, lines, fill=WHITE,
              border=NAVY_INK, title_color=NAVY_INK, badge=None,
              badge_color=AMBER):
    y_top, y_bot = lane_y(lane)
    x = col_x[col_idx]
    y = y_bot + (lane_h - box_h) / 2
    cx = x + box_w / 2
    c.setFillColor(fill)
    c.setStrokeColor(border)
    c.setLineWidth(1.0)
    c.roundRect(x, y, box_w, box_h, 3 * mm, fill=1, stroke=1)
    if badge:
        b_w = min(20 * mm, box_w - 4 * mm)
        b_h = 5 * mm
        c.setFillColor(badge_color)
        c.roundRect(x + box_w - b_w - 2 * mm, y + box_h - b_h - 1.5 * mm,
                    b_w, b_h, 2 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 6)
        c.drawCentredString(x + box_w - b_w / 2 - 2 * mm,
                            y + box_h - b_h - 1.5 * mm + 1.5 * mm, badge)
    c.setFillColor(title_color)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(x + 3 * mm, y + box_h - 5 * mm, title)
    c.setFillColor(INK)
    c.setFont('Helvetica', 6.5)
    ly = y + box_h - 9 * mm
    for ln in lines:
        words = ln.split(' ')
        cur = ''
        for w in words:
            test = (cur + ' ' + w).strip()
            if len(test) > 34 and cur:
                c.drawString(x + 3 * mm, ly, '• ' + cur)
                ly -= 3 * mm
                cur = w
            else:
                cur = test
        if cur:
            c.drawString(x + 3 * mm, ly, '• ' + cur)
            ly -= 3 * mm
    return (cx, y + box_h, y, x, x + box_w)

def link(a, b, color=AMBER_DEEP, label=None):
    cx_a, top_a, bot_a, lx_a, rx_a = a
    cx_b, top_b, bot_b, lx_b, rx_b = b
    if top_a > top_b and bot_a > bot_b and abs(cx_a - cx_b) < box_w:
        arrow(cx_a, bot_a, cx_b, top_b, color, label)
    elif top_a < top_b and bot_a < bot_b and abs(cx_a - cx_b) < box_w:
        arrow(cx_a, top_a, cx_b, bot_b, color, label)
    else:
        if rx_a < lx_b:
            arrow(rx_a, (top_a + bot_a) / 2, lx_b, (top_b + bot_b) / 2, color, label)
        else:
            arrow(lx_a, (top_a + bot_a) / 2, rx_b, (top_b + bot_b) / 2, color, label)

# ── Column 0: Customer books ──
s0_cust = draw_step(0, 'Customer', '1. Book on website',
    ['Picks airport, dates, passengers',
     'Auto-selects vehicle (Car/MPV/8-seat)',
     'Gets instant fixed-price quote'],
    badge='WEB FORM')

s0_sys = draw_step(0, 'System', 'n8n + Airtable',
    ['Webhook creates Airtable record',
     'Status: Pending',
     'SMS to Graham + Roy: new booking'],
    fill=CREAM, badge='AUTOMATION')

# ── Column 1: Admin reviews ──
s1_admin = draw_step(1, 'Admin', '2. Admin reviews booking',
    ['Sets Customer Price + Operator Price',
     'Picks operator (default: RM Transfers)',
     'Sends quote SMS to customer'],
    badge='ADMIN PORTAL')

s1_sys = draw_step(1, 'System', 'Quote SMS sent',
    ['Status -> Awaiting Confirmation',
     'Customer gets SMS with price',
     'Link to accept or decline'],
    fill=CREAM)

# ── Column 2: Customer decides ──
s2_cust = draw_step(2, 'Customer', '3. Accept or decline',
    ['Opens portal via SMS link',
     'Accept -> Stripe Checkout',
     'Decline -> booking archived'],
    badge='PORTAL')

s2_decline = draw_step(2, 'System', 'Decline branch',
    ['Status -> Declined',
     'Admin SMS: booking declined',
     'Moves to Archive tab'],
    fill=RED_BG, border=RED, title_color=RED)

# ── Column 3: Customer pays ──
s3_cust = draw_step(3, 'Customer', '4. Pay via Stripe',
    ['Secure Stripe Checkout page',
     'Promo codes supported',
     'Redirected to thank-you page'],
    badge='STRIPE')

s3_sys = draw_step(3, 'System', 'Stripe webhook fires',
    ['Status -> Accepted',
     'Dispatched To Operator = true',
     'Customer SMS + email confirmation',
     'Admin SMS: payment received'],
    fill=GREEN_BG, border=GREEN, title_color=GREEN,
    badge='WEBHOOK')

# ── Column 4: Cron nudge ──
s4_sys = draw_step(4, 'System', 'If unpaid 24h: nudge',
    ['Daily Vercel cron job',
     'Finds Awaiting Payment > 24h',
     'Single nudge SMS to customer',
     'Flags record to prevent repeat'],
    fill=CREAM, badge='CRON')

s4_op = draw_step(4, 'Operator', '5. Operator gets job',
    ['SMS: new job dispatched',
     'Booking visible in operator portal',
     'PII visible after dispatch only'],
    fill=GREEN_BG, border=GREEN, title_color=GREEN,
    badge='OP PORTAL')

# ── Column 5: Auto-assign + driver ──
s5_sys = draw_step(5, 'System', 'Auto-assign driver',
    ['Looks up operator Default Driver',
     'Sets Driver Name + Phone on booking',
     'Fires driver SMS automatically'],
    fill=PURPLE_BG, border=PURPLE, title_color=PURPLE,
    badge='AUTO')

s5_drv = draw_step(5, 'Driver', '6. Driver gets job SMS',
    ['SMS: ref, customer, pickup, time',
     'Job appears in driver portal',
     'Can also be manually assigned'],
    fill=BLUE_BG, border=BLUE, title_color=BLUE,
    badge='DRIVER PORTAL')

# ── Column 6: Day-of actions ──
s6_sys = draw_step(6, 'System', '24h reminders',
    ['Customer: your trip is tomorrow',
     'Driver: job reminder with details',
     'Sent automatically or manually'],
    fill=CREAM, badge='24H BEFORE')

s6_drv = draw_step(6, 'Driver', '7. Day-of actions',
    ['On the Way -> customer SMS',
     'Arrived -> customer SMS',
     'Return: pickup location SMS',
     'Complete Job -> status update'],
    fill=BLUE_BG, border=BLUE, title_color=BLUE)

# ── Column 7: Post-trip ──
s7_drv = draw_step(7, 'Driver', '8. Close Job',
    ['Status -> Archived',
     'Triggers Trustpilot review SMS',
     'Scheduled 24h later (9am-6pm)'],
    badge='POST-TRIP')

s7_cust = draw_step(7, 'Customer', 'Review invite',
    ['Gets Trustpilot link via SMS',
     'Timed to arrive next day',
     'Booking fully complete'],
    fill=YELLOW_BG, badge='TRUSTPILOT')

# ── Arrows ──
link(s0_cust, s0_sys)
link(s0_sys, s1_admin)
link(s1_admin, s1_sys)
link(s1_sys, s2_cust)
link(s2_cust, s3_cust, label='accept')
link(s2_cust, s2_decline, color=RED, label='decline')
link(s3_cust, s3_sys)
link(s3_sys, s4_op)
link(s3_cust, s4_sys, color=AMBER_DEEP, label='unpaid?')
link(s4_op, s5_sys)
link(s5_sys, s5_drv)
link(s5_drv, s6_drv)
link(s6_sys, s6_drv)
link(s6_drv, s7_drv)
link(s7_drv, s7_cust)

# Footer
c.setFillColor(NAVY)
c.rect(0, 0, page_w, 14 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 8)
c.drawString(20 * mm, 9 * mm,
    'Key: Amber arrows = happy path.  Red = decline branch.  '
    'All SMS via ClickSend.  Email via Resend.  '
    'Payments via Stripe Checkout.  Data stored in Airtable.')
c.setFillColor(AMBER)
c.setFont('Helvetica-Oblique', 7)
c.drawString(20 * mm, 4.5 * mm,
    'Drivers never see customer PII until admin has dispatched. '
    'Operators see the booking on dispatch but with PII redacted '
    'until payment is confirmed. All enforced server-side via '
    '/api/booking?view=operator|driver.')

c.showPage()

# ══════════════════════════════════════════════════════════════════
# PAGE 2 — Booking states & visibility
# ══════════════════════════════════════════════════════════════════

c.setFillColor(NAVY)
c.rect(0, page_h - 24 * mm, page_w, 24 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 18)
c.drawString(20 * mm, page_h - 14 * mm,
             'Booking States, Visibility & SMS Triggers')
c.setFillColor(AMBER)
c.setFont('Helvetica', 10)
c.drawString(20 * mm, page_h - 20 * mm,
             'Every status value the booking can take, who sees it, '
             'and what automated messages fire on each transition.')

states = [
    ('Pending',
     YELLOW_BG, HexColor('#92400E'),
     'New enquiry from website. n8n webhook created the Airtable record.',
     'Admin only. Operator + driver: hidden.',
     'SMS to admins (Graham + Roy) with deep link.'),
    ('Awaiting Confirmation',
     YELLOW_BG, HexColor('#92400E'),
     'Admin has sent a price quote to the customer via SMS.',
     'Admin only.',
     'Customer SMS: price + portal link to accept/decline.'),
    ('Awaiting Payment',
     HexColor('#FFEDD5'), HexColor('#9A3412'),
     'Customer accepted the quote. Waiting for Stripe payment.',
     'Admin only. 24h cron nudge if unpaid.',
     'Nudge SMS after 24h (once only, flagged).'),
    ('Accepted',
     GREEN_BG, HexColor('#166534'),
     'Stripe payment received. Webhook auto-set status + dispatched.',
     'Admin + Operator (after dispatch). Driver after assignment.',
     'Customer: confirmation SMS + email. Admins: payment alert SMS.'),
    ('Declined',
     RED_BG, HexColor('#991B1B'),
     'Customer chose not to proceed via the portal.',
     'Admin Archive tab. Operator + driver: hidden.',
     'Admin SMS: booking declined notification.'),
    ('Completed',
     HexColor('#E0F2FE'), HexColor('#0369A1'),
     'Driver tapped Complete Job. Trip finished, awaiting close.',
     'All portals (admin, operator, driver).',
     'No SMS on this transition.'),
    ('Archived',
     HexColor('#E5E7EB'), HexColor('#374151'),
     'Driver tapped Close Job. Trustpilot review SMS scheduled 24h later.',
     'Admin Archive tab. Operator + driver archive.',
     'Scheduled Trustpilot review SMS (9am-6pm window).'),
]

x = 20 * mm
y = page_h - 32 * mm
row_h = 22 * mm
for name, bg, fg, summary, vis, sms in states:
    c.setFillColor(bg)
    c.roundRect(x, y - row_h, content_w, row_h, 3 * mm, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont('Helvetica-Bold', 12)
    c.drawString(x + 5 * mm, y - 6 * mm, name)
    c.setFillColor(INK)
    c.setFont('Helvetica', 9)
    c.drawString(x + 5 * mm, y - 11 * mm, summary)
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 8.5)
    c.drawString(x + 5 * mm, y - 15.5 * mm, 'Visibility: ' + vis)
    c.setFillColor(BLUE)
    c.setFont('Helvetica', 8)
    c.drawString(x + 5 * mm, y - 19.5 * mm, 'SMS/Email: ' + sms)
    y -= row_h + 3 * mm

c.setFillColor(NAVY)
c.rect(0, 0, page_w, 12 * mm, fill=1, stroke=0)
c.setFillColor(AMBER)
c.setFont('Helvetica-Bold', 8)
c.drawString(20 * mm, 5 * mm,
    'Visibility rules enforced server-side: /api/booking?action=list'
    '&view=operator|driver redacts or filters before data leaves '
    'the API. Stripe webhook auto-advances Pending -> Accepted '
    'and sets Dispatched To Operator = true.')

c.showPage()

# ══════════════════════════════════════════════════════════════════
# PAGE 3 — Technology stack & automation
# ══════════════════════════════════════════════════════════════════

c.setFillColor(NAVY)
c.rect(0, page_h - 24 * mm, page_w, 24 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 18)
c.drawString(20 * mm, page_h - 14 * mm,
             'Technology Stack & Portals')
c.setFillColor(AMBER)
c.setFont('Helvetica', 10)
c.drawString(20 * mm, page_h - 20 * mm,
             'Infrastructure, integrations, and the four portal views '
             'that make up the system.')

y = page_h - 34 * mm
left_col = 20 * mm
right_col = page_w / 2 + 10 * mm
card_w = page_w / 2 - 30 * mm
card_h = 38 * mm

def draw_card(x, y, title, items, bg, fg):
    c.setFillColor(bg)
    c.roundRect(x, y - card_h, card_w, card_h, 4 * mm, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(x + 6 * mm, y - 8 * mm, title)
    c.setFillColor(INK)
    c.setFont('Helvetica', 9)
    ly = y - 14 * mm
    for item in items:
        c.drawString(x + 6 * mm, ly, '• ' + item)
        ly -= 4 * mm

# Row 1
draw_card(left_col, y, 'Frontend & Hosting', [
    'Static HTML + React (JSX) — no build step',
    'Hosted on Vercel with serverless API routes',
    'Address autocomplete via OpenStreetMap/Nominatim',
    'Fixed-fare pricing engine (Car/MPV/8-seat)',
    'Bank holiday + double-time date awareness',
], CREAM, NAVY_INK)

draw_card(right_col, y, 'Payments (Stripe)', [
    '/api/create-checkout: builds Stripe session',
    'Promo codes (promotion codes + coupon IDs)',
    'stripe-webhook: checkout.session.completed',
    'Auto-sets Status=Accepted, dispatches to operator',
    'Stores Amount Paid separately from Customer Price',
], GREEN_BG, HexColor('#166534'))

y -= card_h + 6 * mm

# Row 2
draw_card(left_col, y, 'Data Layer (Airtable)', [
    'Bookings table: full lifecycle tracking',
    'Operators table: name, phone, default driver',
    'Drivers table: name, phone, operator, vehicle',
    'Admins table: username/password for portal auth',
    'All CRUD via Vercel serverless /api/* endpoints',
], BLUE_BG, HexColor('#1E40AF'))

draw_card(right_col, y, 'Notifications', [
    'SMS: ClickSend REST API (all automated)',
    'Email: Resend API (booking confirmations)',
    'n8n: initial webhook + Airtable record creation',
    'Vercel Cron: daily nudge for unpaid bookings',
    '12+ SMS actions: quote, confirm, remind, review...',
], PURPLE_BG, PURPLE)

y -= card_h + 6 * mm

# Row 3 — Portals
draw_card(left_col, y, 'Admin Portal (admin.html)', [
    'Kanban board: Pending/Awaiting/Accepted/Archive',
    'Set prices, assign operators, dispatch bookings',
    'Send quote SMS, acknowledge payment, manage all',
    'Super-admin: manage operators, drivers, stats',
    'PIN-protected login via /api/login',
], HexColor('#EEF2FF'), HexColor('#4338CA'))

draw_card(right_col, y, 'Operator Portal (operator.html)', [
    'Sees dispatched bookings only',
    'Allocates drivers from their own driver list',
    'PII redacted until paid + dispatched',
    'Resend confirmation email to customer',
    'Username/password login via /api/login',
], HexColor('#F0FDF4'), HexColor('#047857'))

y -= card_h + 6 * mm

# Row 4
draw_card(left_col, y, 'Driver Portal (driver-portal.html)', [
    'Sees only their assigned jobs',
    'Action buttons: On Way / Arrived / Complete',
    'Each action triggers customer SMS automatically',
    'Return-leg: send pickup location SMS',
    'Close Job: archives + schedules review invite',
], HexColor('#FFF7ED'), HexColor('#C2410C'))

draw_card(right_col, y, 'Customer Portal (portal.html)', [
    'Unique link per booking (via ?ref=ATL-XXXXXX)',
    'View trip details, driver info, status',
    'Accept / decline quote buttons',
    'Pay via Stripe Checkout button',
    'PWA: installable to home screen',
], HexColor('#FFFBEB'), AMBER_DEEP)

# Footer
c.setFillColor(NAVY)
c.rect(0, 0, page_w, 12 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('Helvetica-Bold', 8)
c.drawString(20 * mm, 5 * mm,
    'RM Transfers — Airport Transfers Liverpool  |  '
    'airporttaxitransfersliverpool.co.uk  |  '
    'System documentation — May 2026  |  '
    'All automation runs 24/7 without manual intervention')

c.save()
print(f'Wrote {OUT}')
