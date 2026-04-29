"""Generate a printable PDF flow diagram of the RM Transfers customer
booking journey. Output: rm-transfers-booking-flow.pdf in the project root.

Designed for a human reader — five swimlanes (Customer / Admin /
Operator / Driver / System) and stage cards with arrows showing the
end-to-end happy path plus the decline branch.
"""
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm

OUT = 'rm-transfers-booking-flow.pdf'

# Page setup — A3 landscape so we can fit the whole flow on one page.
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

c = canvas.Canvas(OUT, pagesize=(page_w, page_h))

# ── Title bar ─────────────────────────────────────────────────────
c.setFillColor(NAVY)
c.rect(0, page_h - 30 * mm, page_w, 30 * mm, fill=1, stroke=0)
c.setFillColor(HexColor('#FFFFFF'))
c.setFont('Helvetica-Bold', 22)
c.drawString(20 * mm, page_h - 16 * mm, 'RM Transfers — Customer Booking Journey')
c.setFillColor(AMBER)
c.setFont('Helvetica', 11)
c.drawString(20 * mm, page_h - 23 * mm,
             'End-to-end flow from website enquiry through to completed trip. '
             'Read top-to-bottom, left-to-right.')

# ── Swimlanes ─────────────────────────────────────────────────────
LANES = [
    ('Customer',  HexColor('#FFFBEB'), AMBER_DEEP),
    ('Admin',     HexColor('#EEF2FF'), HexColor('#4338CA')),
    ('Operator',  HexColor('#F0FDF4'), HexColor('#047857')),
    ('Driver',    HexColor('#FFF7ED'), HexColor('#C2410C')),
    ('System',    HexColor('#F3F4F6'), HexColor('#374151')),
]

content_top = page_h - 30 * mm - 4 * mm        # below title bar
content_bottom = 20 * mm
content_h = content_top - content_bottom
lane_h = content_h / len(LANES)
content_left = 20 * mm
content_right = page_w - 12 * mm
content_w = content_right - content_left

# Draw lane backgrounds + labels
for i, (label, bg, fg) in enumerate(LANES):
    y = content_top - lane_h * (i + 1)
    c.setFillColor(bg)
    c.rect(content_left, y, content_w, lane_h, fill=1, stroke=0)
    # left label strip
    c.setFillColor(fg)
    c.rect(content_left, y, 18 * mm, lane_h, fill=1, stroke=0)
    c.setFillColor(HexColor('#FFFFFF'))
    c.setFont('Helvetica-Bold', 11)
    # Rotate the label vertically so it reads cleanly
    c.saveState()
    c.translate(content_left + 9 * mm, y + lane_h / 2)
    c.rotate(90)
    c.drawCentredString(0, -3, label.upper())
    c.restoreState()

# Lane row helpers
def lane_y(label):
    for i, (l, _bg, _fg) in enumerate(LANES):
        if l == label:
            y_top = content_top - lane_h * i
            y_bot = y_top - lane_h
            return y_top, y_bot
    raise KeyError(label)

# ── Step boxes ────────────────────────────────────────────────────
# Each step lives in a lane; we draw a rounded rectangle with title
# and bullet body. Steps are arranged in columns at fixed x positions.

# Column anchors. We'll place steps at these x positions.
left_pad = content_left + 18 * mm + 4 * mm  # past the lane label strip
right_edge = content_right - 4 * mm
columns = 6
col_gap = (right_edge - left_pad) / columns
col_x = [left_pad + col_gap * i for i in range(columns + 1)]

box_w = col_gap - 6 * mm
box_h = lane_h - 8 * mm

def draw_step(col_idx, lane, title, lines, fill=HexColor('#FFFFFF'),
              border=NAVY_INK, title_color=NAVY_INK, badge=None,
              badge_color=AMBER):
    """Draw a step card centred in (col_idx, lane). Returns (cx, cy_top, cy_bot)
    for arrow anchoring."""
    y_top, y_bot = lane_y(lane)
    x = col_x[col_idx]
    y = y_bot + (lane_h - box_h) / 2
    cx = x + box_w / 2
    # Card
    c.setFillColor(fill)
    c.setStrokeColor(border)
    c.setLineWidth(1.2)
    c.roundRect(x, y, box_w, box_h, 4 * mm, fill=1, stroke=1)
    # Optional badge (top-right corner)
    if badge:
        b_w = 22 * mm
        b_h = 6 * mm
        c.setFillColor(badge_color)
        c.roundRect(x + box_w - b_w - 2 * mm, y + box_h - b_h - 2 * mm,
                    b_w, b_h, 2 * mm, fill=1, stroke=0)
        c.setFillColor(HexColor('#FFFFFF'))
        c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(x + box_w - b_w / 2 - 2 * mm,
                            y + box_h - b_h - 2 * mm + 1.8 * mm, badge)
    # Title
    c.setFillColor(title_color)
    c.setFont('Helvetica-Bold', 10)
    c.drawString(x + 4 * mm, y + box_h - 6 * mm, title)
    # Body lines
    c.setFillColor(INK)
    c.setFont('Helvetica', 8)
    line_y = y + box_h - 11 * mm
    for ln in lines:
        # crude wrap at ~36 chars
        words = ln.split(' ')
        cur = ''
        for w in words:
            test = (cur + ' ' + w).strip()
            if len(test) > 38 and cur:
                c.drawString(x + 4 * mm, line_y, '• ' + cur if cur and not cur.startswith('•') else cur)
                line_y -= 3.4 * mm
                cur = w
            else:
                cur = test
        if cur:
            c.drawString(x + 4 * mm, line_y, '• ' + cur)
            line_y -= 3.4 * mm
    return (cx, y + box_h, y, x, x + box_w)

def arrow(x1, y1, x2, y2, color=AMBER_DEEP, label=None):
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.line(x1, y1, x2, y2)
    # arrowhead
    import math
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

# ── Layout the steps ──────────────────────────────────────────────
# Column 0 — Booking submitted
s_book = draw_step(
    0, 'Customer',
    '1. Customer books on website',
    [
        'Fills the booking form on rmtransfers homepage',
        'Receives an immediate "we have your enquiry" SMS',
    ],
    fill=HexColor('#FFFFFF'), badge='WEB FORM',
)

s_n8n = draw_step(
    0, 'System',
    'n8n workflow runs',
    [
        'Creates the booking record in Airtable (Status: Pending)',
        'SMSes Graham + Roy with a deep link to the new booking',
    ],
    fill=CREAM, badge='AUTOMATION',
)

# Column 1 — Admin quotes
s_quote = draw_step(
    1, 'Admin',
    '2. Admin opens job, sets Customer Price',
    [
        'Default operator: RM Transfers (admin can change)',
        'Operator Price defaults to Customer Price (editable)',
        'Pastes the payment link into the card',
    ],
    fill=HexColor('#FFFFFF'), badge='ADMIN PORTAL',
)

s_send_quote = draw_step(
    1, 'System',
    'Send Quote SMS',
    [
        'Status -> Awaiting Confirmation',
        'Customer SMS: price + accept / decline link',
    ],
    fill=CREAM,
)

# Column 2 — Customer accepts/declines
s_decide = draw_step(
    2, 'Customer',
    '3. Customer accepts or declines',
    [
        'Visits portal.html via SMS link',
        'Taps Accept (-> Awaiting Payment) or Decline',
    ],
    fill=HexColor('#FFFFFF'), badge='PORTAL',
)

s_decline = draw_step(
    2, 'System',
    'Decline branch',
    [
        'Status -> Declined',
        'Booking moves to admin Archive tab',
        '(SMS to admins on roadmap)',
    ],
    fill=RED_BG, border=RED, title_color=RED,
)

# Column 3 — Customer pays / 24h nudge
s_pay = draw_step(
    3, 'Customer',
    '4. Customer pays via payment link',
    [
        'Pays through the operator\'s payment link',
        'No charge if they declined or never paid',
    ],
    fill=HexColor('#FFFFFF'),
)

s_nudge = draw_step(
    3, 'System',
    'If unpaid 24h: nudge SMS',
    [
        'Daily cron checks Awaiting Payment > 24h old',
        'Single nudge SMS asking if they still want to proceed',
        'Admin can fire it manually too',
    ],
    fill=CREAM, badge='CRON',
)

# Column 4 — Admin acks payment, dispatches
s_ack = draw_step(
    4, 'Admin',
    '5. Admin acknowledges payment',
    [
        'Status -> Accepted',
        'Customer gets payment-received SMS + email',
        '(Driver details intentionally NOT in this message)',
    ],
    fill=HexColor('#FFFFFF'), badge='ADMIN PORTAL',
)

s_dispatch = draw_step(
    4, 'Operator',
    '6. Admin clicks Dispatch to Operator',
    [
        'Booking becomes visible in operator portal',
        'Operator gets SMS: "New job dispatched"',
    ],
    fill=GREEN_BG, border=GREEN, title_color=GREEN,
)

# Column 5 — Operator allocates driver, driver works
s_alloc = draw_step(
    5, 'Operator',
    '7. Operator allocates a driver',
    [
        'Picks from their own driver list',
        'Driver record holds vehicle / reg / badge no.',
    ],
    fill=HexColor('#FFFFFF'), badge='OPERATOR PORTAL',
)

s_drv_sms = draw_step(
    5, 'Driver',
    '8. Driver gets job SMS + sees in portal',
    [
        'SMS with ref, customer, pickup, time, flight',
        'Booking now appears in their /driver-portal',
        'Buttons: On Way / Arrived / Complete',
    ],
    fill=BLUE_BG, border=BLUE, title_color=BLUE,
)

# ── Below-grid summary tile (closing of the trip) ─────────────────
# We use the System lane bottom for a closing card spanning two cols.
def draw_finish_card():
    y_top, y_bot = lane_y('Driver')
    # span columns 5-6 below the driver step
    pass  # already covered by step in column 5 lane Driver

# ── Arrows ────────────────────────────────────────────────────────
def link(a, b, color=AMBER_DEEP, label=None):
    """a, b are step tuples. Pick sensible anchor points."""
    cx_a, top_a, bot_a, lx_a, rx_a = a
    cx_b, top_b, bot_b, lx_b, rx_b = b
    # If lanes differ vertically, prefer top/bottom edges
    if top_a > top_b and bot_a > bot_b and abs(cx_a - cx_b) < box_w:
        # b is below a, same-ish column
        arrow(cx_a, bot_a, cx_b, top_b, color, label)
    elif top_a < top_b and bot_a < bot_b and abs(cx_a - cx_b) < box_w:
        arrow(cx_a, top_a, cx_b, bot_b, color, label)
    else:
        # horizontal
        if rx_a < lx_b:
            arrow(rx_a, (top_a + bot_a) / 2, lx_b, (top_b + bot_b) / 2, color, label)
        else:
            arrow(lx_a, (top_a + bot_a) / 2, rx_b, (top_b + bot_b) / 2, color, label)

link(s_book, s_n8n)
link(s_n8n, s_quote)
link(s_quote, s_send_quote)
link(s_send_quote, s_decide)
link(s_decide, s_pay, label='accept')
link(s_decide, s_decline, color=RED, label='decline')
link(s_pay, s_ack)
# branch from pay: 24h nudge to Customer
link(s_pay, s_nudge, color=AMBER_DEEP, label='still unpaid?')
link(s_ack, s_dispatch)
link(s_dispatch, s_alloc)
link(s_alloc, s_drv_sms)

# ── Footer key + final-stage notes ────────────────────────────────
c.setFillColor(NAVY)
c.rect(0, 0, page_w, 14 * mm, fill=1, stroke=0)
c.setFillColor(HexColor('#FFFFFF'))
c.setFont('Helvetica-Bold', 9)
c.drawString(20 * mm, 9 * mm, 'After the trip:')
c.setFont('Helvetica', 9)
c.drawString(46 * mm, 9 * mm,
             '  driver taps Complete Job (status -> Archived). 24 hours later the customer gets a Trustpilot review SMS.   '
             'All admin / operator / driver portals run from the same Airtable base; data flows back in real time.')
c.setFont('Helvetica-Oblique', 8)
c.setFillColor(AMBER)
c.drawString(20 * mm, 4 * mm,
             'Generated for internal reference. Drivers never see customer details until admin has acknowledged payment AND dispatched the booking. '
             'Operators see the booking on dispatch but with PII redacted until that moment.')

c.showPage()

# ── Page 2: a tighter "key states" reference card ────────────────
c.setFillColor(NAVY)
c.rect(0, page_h - 24 * mm, page_w, 24 * mm, fill=1, stroke=0)
c.setFillColor(HexColor('#FFFFFF'))
c.setFont('Helvetica-Bold', 18)
c.drawString(20 * mm, page_h - 14 * mm, 'Booking states & who sees what')
c.setFillColor(AMBER)
c.setFont('Helvetica', 10)
c.drawString(20 * mm, page_h - 20 * mm,
             'Quick reference for every Status value the booking can take.')

states = [
    ('Pending',
     YELLOW_BG, HexColor('#92400E'),
     'New website enquiry. Admin has the booking; nobody else does.',
     'Admin only. Operator + driver: hidden.'),
    ('Awaiting Confirmation',
     YELLOW_BG, HexColor('#92400E'),
     'Admin has SMS\'d the customer a price; waiting for them to accept or decline.',
     'Admin only.'),
    ('Awaiting Payment',
     HexColor('#FFEDD5'), HexColor('#9A3412'),
     'Customer accepted the price. Waiting for them to pay via the payment link.',
     'Admin only. (Operator still hidden, until admin has dispatched.)'),
    ('Accepted',
     GREEN_BG, HexColor('#166534'),
     'Admin acknowledged payment. Booking is real and locked in.',
     'Admin sees the card; the operator and driver only see it once dispatched.'),
    ('Declined',
     RED_BG, HexColor('#991B1B'),
     'Customer chose not to proceed. No driver, no charge.',
     'Sits in admin\'s Archive tab. Operator + driver: hidden.'),
    ('Completed / Archived',
     HexColor('#E5E7EB'), HexColor('#374151'),
     'Driver has marked the job done. Trustpilot invite scheduled 24h later.',
     'Admin Archive tab. Operator and driver still see it in their archive too.'),
]

x = 20 * mm
y = page_h - 32 * mm
row_h = 20 * mm
for name, bg, fg, summary, vis in states:
    c.setFillColor(bg)
    c.roundRect(x, y - row_h, content_w, row_h, 3 * mm, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont('Helvetica-Bold', 12)
    c.drawString(x + 5 * mm, y - 7 * mm, name)
    c.setFillColor(INK)
    c.setFont('Helvetica', 9.5)
    c.drawString(x + 5 * mm, y - 12 * mm, summary)
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(MUTED)
    c.drawString(x + 5 * mm, y - 17 * mm, 'Visibility — ' + vis)
    y -= row_h + 4 * mm

c.setFillColor(NAVY)
c.rect(0, 0, page_w, 12 * mm, fill=1, stroke=0)
c.setFillColor(AMBER)
c.setFont('Helvetica-Bold', 9)
c.drawString(20 * mm, 5 * mm,
             'Visibility rules are enforced server-side: /api/booking?action=list&view=operator|driver redacts or filters before the data leaves the API.')

c.save()
print(f'Wrote {OUT}')
