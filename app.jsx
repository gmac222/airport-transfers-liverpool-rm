const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "quiet",
  "amberIntensity": "balanced",
  "showStickyBar": true,
  "imageStyle": "photo-placeholder"
}/*EDITMODE-END*/;

const HEADLINES = {
  quiet: { main: "From your door", accent: "to the terminal.", tail: "And back." },
  direct: { main: "Airport transfers,", accent: "both ways — fixed price.", tail: "" },
  local: { main: "Door to airport,", accent: "we'll be there when you land.", tail: "" }
};

const PRICES = { LJLA: 65, MAN: 75 };

function Icon({ name, size = 20, color = "currentColor" }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    plane: <><path d="M10.5 13.5L3 9l2-2 8 3 5-5a2 2 0 113 3l-5 5 3 8-2 2-4.5-7.5L5 18l-1-1 6.5-3.5z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    check: <><path d="M5 12l4.5 4.5L19 7" /></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>,
    phone: <><path d="M5 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 6a2 2 0 012-2z" /></>,
    meet: <><circle cx="12" cy="7" r="3" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /><path d="M16 11l-2 3 4 1" /></>,
    luggage: <><rect x="6" y="6" width="12" height="14" rx="2" /><path d="M9 6V3h6v3M9 10v8M15 10v8" /></>,
    track: <><path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pound: <><path d="M15 6.5A3.5 3.5 0 008 9v2H6M8 11h5M8 11c0 3-2 5-2 6h12" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>
  };
  return <svg {...props}>{paths[name]}</svg>;
}

/* ---------- LOGO MARK (pin + plane) ---------- */
function LogoMark({ size=64 }) {
  return (
    <img 
      src="./assets/logo.png" 
      alt="airport transfers Liverpool by RM Transfers" 
      style={{ height: size, width: "auto", objectFit: "contain" }} 
    />
  );
}

/* ---------- NAV ---------- */
function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <a href="#" className="brand" aria-label="Airport Transfers Liverpool home">
          <LogoMark size={56} />
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#prices">Prices</a>
          <a href="#faq">FAQ</a>
          <a href="#reviews">Reviews</a>
        </div>
        <div className="nav-cta">
          <a href="#book" className="btn btn-primary btn-sm">Book Now</a>
        </div>
      </div>
    </nav>
  );
}

/* ---------- HERO ---------- */
function Hero({ headline }) {
  const h = HEADLINES[headline] || HEADLINES.quiet;
  return (
    <header className="hero">
      <div className="wrap hero-grid">
        <div>
          <span className="eyebrow"><span className="pulse"></span>Booking for today & tomorrow — 3 drivers free</span>
          <h1 className="h1">
            {h.main} <em>{h.accent}</em>
            {h.tail && <><br /><span style={{ color: "black" }}>{h.tail}</span></>}
          </h1>
          <p className="sub">
            Airport Transfers Liverpool is a small, local private hire firm. We pick you up from your front door, take you to Liverpool John Lennon or Manchester Airport, and meet you in Arrivals on the way back. Fixed price, both legs. No surge, no meter, no surprises.
          </p>

          <div className="hero-prices" id="prices">
            <div className="price-card">
              <div>
                <div className="route">Liverpool John Lennon</div>
                <div className="airport">LJLA · door-to-terminal 25 mins</div>
              </div>
              <div className="amt">£65<small>each way · £130 return</small></div>
            </div>
            <div className="price-card">
              <div>
                <div className="route">Manchester Airport</div>
                <div className="airport">MAN · door-to-terminal 55 mins</div>
              </div>
              <div className="amt">£75<small>each way · £150 return</small></div>
            </div>
          </div>

          <div className="hero-cta" style={{ flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
            <a href="#book" className="btn btn-primary" style={{ padding: "16px 32px", fontSize: "16px", width: "100%", justifyContent: "center" }}>
              Book Now <Icon name="arrow" size={16} />
            </a>
            <div style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon name="check" size={14} color="#23c55e" /> Takes 60 seconds • No card needed • Text back in 10 minutes
            </div>
          </div>

          <div className="trust">
            <div className="trust-item">
              <span className="stars">★★★★★</span>
              <span className="trust-text"><b>4.9</b> on Google · 380+ reviews</span>
            </div>
            <div className="trust-item">
              <span className="stars">★★★★★</span>
              <span className="trust-text"><b>Excellent</b> on Trustpilot</span>
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div className="hero-media" role="img" aria-label="8-seater minibus" style={{ backgroundImage: "url('./assets/airport-transfers-wirral.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="overlay-badge">
              <div className="av">ATL</div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>Driver today</div>
                <div>Local driver · 18 yrs</div>
              </div>
            </div>
          </div>
          <div className="floating-card">
            <div className="ic"><Icon name="check" size={18} /></div>
            <div>
              <b>Flight BA2391 tracked</b>
              <span>Driver will wait if you're delayed</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------- AUTHORITY STRIP ---------- */
function AuthorityStrip() {
  const items = [
    { icon: "clock",  big: "13+",      small: "years trading · est. 2011" },
    { icon: "check",  big: "4.9★",     small: "Google · 380+ reviews" },
    { icon: "shield", big: "Licensed", small: "Private hire · DBS checked" },
    { icon: "pound",  big: "£5M",      small: "Public liability insured" }
  ];
  return (
    <section className="authority" aria-label="Trust and credentials">
      <div className="wrap">
        <div className="authority-grid">
          {items.map((i, k) => (
            <div className="authority-item" key={k} style={{ animationDelay: `${k * 80}ms` }}>
              <div className="authority-ic"><Icon name={i.icon} size={20} /></div>
              <div>
                <div className="big">{i.big}</div>
                <div className="small">{i.small}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- HOW IT WORKS ---------- */
function HowItWorks() {
  const steps = [
    { n: 1, title: "Book both legs at once", body: "Tell us your pickup address and flight times — out and back. One booking, one fixed price, one driver looking after you. Confirmation text arrives within 10 minutes.", time: "~2 min to book" },
    { n: 2, title: "We pick you up from home", body: "Driver rings the bell at the agreed time. Bags in the boot, straight on the M53, dropped at the terminal door. No airport parking to find.", time: "LJLA 25 min · MAN 55 min" },
    { n: 3, title: "We meet you when you land", body: "Driver waits inside Arrivals with a sign showing your name. We track your flight so they're there whether you're early, late or delayed.", time: "inside the terminal" }
  ];
  return (
    <section id="how">
      <div className="wrap">
        <div className="section-head">
          <span className="section-kicker">How it works</span>
          <h2 className="h2">Three steps. No app. No faff.</h2>
          <p className="section-sub">We've been doing this since 2011. The whole thing is designed so you don't have to worry about it on the day.</p>
        </div>
        <div className="steps">
          {steps.map(s => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="step-time"><span className="dot"></span>{s.time}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- PROMISE ---------- */
function FixedPricePromise() {
  const items = [
    { title: "No surge pricing, ever", body: "Friday 5pm, Christmas morning, bank holiday — same £65 or £75." },
    { title: "No extras for flight delays", body: "We track your flight. If you're late, we wait. You don't pay a penny more." },
    { title: "No hidden fees", body: "The price you're quoted includes parking, tolls, meet & greet and VAT. That's the lot." },
    { title: "Cancel free up to 24 hrs", body: "Plans change. We get it. No cancellation fee outside 24 hours of pickup." }
  ];
  return (
    <section className="cream">
      <div className="wrap">
        <div className="promise">
          <div className="promise-grid">
            <div>
              <span className="section-kicker" style={{ color: "var(--amber)" }}>The fixed-price promise</span>
              <h2>The price we quote is the price you pay.</h2>
              <p className="sub-light">We've watched people get stung by £90 Ubers at midnight and £200 airport car parks for a long weekend. That's not what we do.</p>
            </div>
            <ul className="promise-list">
              {items.map((i, k) => (
                <li key={k}>
                  <div className="check"><Icon name="check" size={16} /></div>
                  <div>
                    <b>{i.title}</b>
                    <span>{i.body}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- MEET AND GREET ---------- */
function MeetAndGreet() {
  return (
    <section>
      <div className="wrap mng-grid">
        <div className="mng-media" role="img" aria-label="8-seater minibus" style={{ backgroundImage: "url('./assets/airport-transfers-wirral.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="flight-card">
            <div className="row"><span>Flight</span><b>BA2391</b></div>
            <div className="flight-route">
              <span>ALC</span>
              <Icon name="plane" size={16} color="var(--muted)" />
              <span className="arr">LJLA</span>
            </div>
            <div className="row" style={{ marginTop: 8 }}><span>Landing</span><b>14:42</b></div>
            <div className="status"><span className="dot"></span>On track · driver notified</div>
          </div>
        </div>
        <div className="mng-text">
          <span className="section-kicker">Both ways, one driver</span>
          <h2 className="h2">We pick you up at home. We meet you in Arrivals.</h2>
          <p className="section-sub">Most of our bookings are returns — same driver, both legs, so you're never explaining yourself twice. Door to terminal on the way out. Terminal to door on the way back.</p>
          <ul className="mng-list">
            <li>
              <div className="ic"><Icon name="track" size={20} /></div>
              <div><b>Live flight tracking on the return</b><span>We check your flight the night before and the hour you land. Early, late or delayed — the driver is already there.</span></div>
            </li>
            <li>
              <div className="ic"><Icon name="meet" size={20} /></div>
              <div><b>Sign with your name in Arrivals</b><span>No pickup lane to hunt, no phone calls from the baggage hall. Walk through and look for your surname on the sign.</span></div>
            </li>
            <li>
              <div className="ic"><Icon name="clock" size={20} /></div>
              <div><b>60 minutes free waiting</b><span>Baggage carousel acting up? Passport queue? We're not going anywhere. Included in the fixed price.</span></div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- REVIEWS ---------- */
function Reviews() {
  const items = [
    { name: "Vicky Tierney", init: "VT", when: "a month ago", text: "Really good experience with R M Transfers. Excellent communication, clear meeting points and prompt arrival and drop off. Completely stress and hassle free. Highly recommend." },
    { name: "Stephen Blackhurst", init: "SB", when: "5 months ago", text: "As always Roy showed excellent communication skills, even politely reminding us he would be there at 3am by messaging us the day before. Weve used the larger vehicle on both trips as we are a party of 6 plus luggage for which there is lots of room. Highly recommended and competitive on price." },
    { name: "Iain 'Turbs' Turbitt", init: "IT", when: "6 months ago", text: "Cosimo picked up us on time for an airport transfer in a mini-van that was clean and very comfortable. He assisted with loading and unloading of cases at both ends of the journey. The quotation/booking process was easy and followed up with prompt and great communication throughout. Competitively priced. Highly recommend. Thanks." },
    { name: "Charlotte Parke", init: "CP", when: "5 months ago", text: "Had our first experience today. Can only say good things, arrived on time and Roy was friendly and helpful with all our cases. Will be using again and will recommend to anyone looking for a reliable driver." },
    { name: "Julie Quinn", init: "JQ", when: "5 months ago", text: "Great as always, even when our flight was cancelled Roy was great and it was no issue to collect us at the new time 👌 booked again for August 2026" },
    { name: "Pete Mort", init: "PM", when: "6 months ago", text: "Excellent service. Roy is always on time, very helpful with luggage and a very smooth driver. Vehicles are clean and comfortable. Used RM Transfers for years and wouldn't use anyone else." }
  ];
  return (
    <section id="reviews" className="cream">
      <div className="wrap">
        <div className="section-head reviews-head">
          <span className="section-kicker">What our customers say</span>
          <h2 className="h2">Booked, tracked, arrived — on repeat.</h2>
          <div className="score">
            <div className="num">4.9</div>
            <div>
              <div className="stars">★★★★★</div>
              <div className="score-meta"><b>380+ reviews</b> across Google & Trustpilot</div>
            </div>
          </div>
        </div>
        <div className="reviews">
          {items.map((r, k) => (
            <div className="review" key={k}>
              <div className="stars">★★★★★</div>
              <p>"{r.text}"</p>
              <div className="review-by">
                <div className="av">{r.init}</div>
                <div className="meta">
                  <b>{r.name}</b>
                  <span>{r.when}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const items = [
    { q: "Can I book the outbound and return together?", a: "Yes — and honestly, most people do. One booking, one fixed price for both legs, and where possible the same driver takes you out and picks you up. You only need to give us your flight numbers; we'll work the rest out." },
    { q: "How do I know the driver will actually turn up?", a: "Every booking gets a confirmation text within 10 minutes with your driver's name, the minibus, and the plate. The night before pickup we send a reminder. The morning of, your driver messages you directly. If that sounds like a lot of texts — it's deliberate. It's the bit Uber doesn't do." },
    { q: "What happens if my flight is delayed?", a: "We check your flight number before leaving to collect you. If you're delayed, we delay. There's no extra charge — the fixed price covers up to 60 minutes of waiting in Arrivals, and honestly we've waited longer without ever billing for it. Fixed price means fixed price." },
    { q: "What if I'm not ready when you arrive at home?", a: "Fine. We build a few minutes' grace into every pickup, and we'd rather be early than late. Just tell us what time you want to leave the house and we'll plan back from that." },
    { q: "Are your drivers licensed and insured?", a: "Yes — every driver is fully licensed by the local council for private hire, DBS checked, and the business carries full public liability and hire & reward insurance. Happy to show you the paperwork before booking if you'd like." },
    { q: "Will my luggage fit?", a: "We operate a comfortable 8-seater minibus — fits up to 8 passengers and plenty of luggage. Whether you're travelling light or heavy, we've got you covered in our spacious minibus (same fixed-price rules apply)." },
    { q: "Can I pay in cash?", a: "Cash or card, whichever suits. Card payment is taken by the driver at the end of the journey via contactless. No booking fee either way." },
    { q: "How far ahead do I need to book?", a: "Ideally 24 hours for guaranteed availability. We often take same-day bookings when a driver's free — call 0151 123 4567 and we'll tell you straight." }
  ];
  return (
    <section id="faq">
      <div className="wrap">
        <div className="section-head">
          <span className="section-kicker">Common questions</span>
          <h2 className="h2">The things people actually worry about.</h2>
        </div>
        <div className="faq">
          {items.map((it, k) => (
            <details key={k} {...(k === 0 ? { open: true } : {})}>
              <summary>
                {it.q}
                <span className="plus">+</span>
              </summary>
              <div className="ans">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- BOOKING FORM ---------- */
function BookingForm() {
  const [tripType, setTripType] = useState("return"); // "return" | "oneway"
  const [onewayDir, setOnewayDir] = useState("to"); // for oneway only
  const [airport, setAirport] = useState("LJLA");
  const [pax, setPax] = useState(2);
  const [bags, setBags] = useState(2);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [bookingRef, setBookingRef] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    address: "",
    // outbound (home → airport)
    outDate: "", outTime: "", outFlight: "",
    // return (airport → home)
    retDate: "", retTime: "", retFlight: "",
    // single-leg (oneway)
    legDate: "", legTime: "", legFlight: "",
    notes: ""
  });

  const legPrice = PRICES[airport];
  const price = tripType === "return" ? legPrice * 2 : legPrice;

  function upd(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  }

  async function submit(e) {
    e.preventDefault();
    console.log("[booking] submit fired");
    const errs = {};
    if (!form.name.trim()) errs.name = "We need a name to greet you with";
    if (!form.phone.trim()) errs.phone = "So we can text you the driver's details";
    if (!form.address.trim()) errs.address = "Home address please — where we pick up & drop off";

    const minNoticeMs = 12 * 60 * 60 * 1000;
    const now = new Date();

    const validateDate = (dateStr, timeStr, dateField, timeField) => {
      if (dateStr && timeStr) {
        const tripDate = new Date(`${dateStr}T${timeStr}`);
        if (tripDate.getTime() - now.getTime() < minNoticeMs) {
          errs[dateField] = "Minimum 12 hours notice required";
          errs[timeField] = "Call 0151 123 4567 for last-minute jobs";
        }
      }
    };

    if (tripType === "return") {
      if (!form.outDate) errs.outDate = "Outbound date";
      if (!form.outTime) errs.outTime = "Pickup time";
      if (!form.retDate) errs.retDate = "Return date";
      if (!form.retTime) errs.retTime = "Landing time";
      if (!form.retFlight.trim()) errs.retFlight = "So we can track your return flight";
      
      validateDate(form.outDate, form.outTime, "outDate", "outTime");
      validateDate(form.retDate, form.retTime, "retDate", "retTime");
    } else {
      if (!form.legDate) errs.legDate = "Pick a date";
      if (!form.legTime) errs.legTime = "Pick a time";
      if (onewayDir === "from" && !form.legFlight.trim()) errs.legFlight = "So we can track it";

      validateDate(form.legDate, form.legTime, "legDate", "legTime");
    }

    if (Object.keys(errs).length) {
      console.log("[booking] validation failed", errs);
      setErrors(errs);
      return;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed lookalikes O,0,1,I
    const randomStr = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const ref = "ATL-" + randomStr;
    const payload = {
      ref,
      submittedAt: new Date().toISOString(),
      tripType,
      onewayDir: tripType === "oneway" ? onewayDir : null,
      airport,
      airportName: airport === "LJLA" ? "Liverpool John Lennon" : "Manchester",
      passengers: pax,
      luggage: bags,
      priceGBP: price,
      legPriceGBP: legPrice,
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim()
      },
      outbound: tripType === "return"
        ? { date: form.outDate, time: form.outTime, flight: form.outFlight.trim() || null }
        : (onewayDir === "to" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() || null } : null),
      return: tripType === "return"
        ? { date: form.retDate, time: form.retTime, flight: form.retFlight.trim() }
        : (onewayDir === "from" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() } : null),
      notes: form.notes.trim() || null,
      pageUrl: typeof window !== "undefined" ? window.location.href : null
    };

    console.log("[booking] POSTing payload", payload);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("https://gmac222.app.n8n.cloud/webhook/3c702483-e68c-428a-8c2c-429cbdf61668", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("[booking] webhook response", res.status);
      if (!res.ok) throw new Error("Webhook responded " + res.status);
      window.location.href = `/thank-you/?ref=${ref}&price=${price}&type=${tripType}`;
    } catch (err) {
      console.error("[booking] submit error", err);
      setSubmitError("We couldn't send that just now. Please call 0151 123 4567 or try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="book-form">
        <div className="book-success">
          <div className="check"><Icon name="check" size={32} /></div>
          <h3>Booking request received.</h3>
          <p>We'll text you within 10 minutes with your driver's name and the minibus details{tripType === "return" ? " for both legs" : ""}. If you've booked for today, we'll call within 5.</p>
          <div className="ref" id="book-ref" tabIndex={-1}>Ref: {bookingRef} · £{price} fixed {tripType === "return" ? "return" : "one-way"}</div>
          <div style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
            Need to change something? Call us on <a href="tel:+441511234567" style={{ color: "var(--navy-ink)", fontWeight: 600 }}>0151 123 4567</a>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="book-form" onSubmit={submit} noValidate>
      <h3>Book your transfer</h3>
      <p className="form-sub">Fixed price confirmed by text within 10 minutes.</p>

      <div className="field">
        <label>Trip type</label>
        <div className="dir-toggle" role="tablist">
          <button type="button" className={tripType === "return" ? "active" : ""} onClick={() => setTripType("return")}>Return · best value</button>
          <button type="button" className={tripType === "oneway" ? "active" : ""} onClick={() => setTripType("oneway")}>One way</button>
        </div>
      </div>

      <div className="field">
        <label>Airport <span className="req">*</span></label>
        <div className="airport-pick">
          <button type="button" className={airport === "LJLA" ? "active" : ""} onClick={() => setAirport("LJLA")}>
            <span className="code">LJLA · 25 min</span>
            <span className="name">Liverpool John Lennon</span>
            <span className="p">£{tripType === "return" ? 130 : 65} {tripType === "return" ? "return" : "one way"}</span>
          </button>
          <button type="button" className={airport === "MAN" ? "active" : ""} onClick={() => setAirport("MAN")}>
            <span className="code">MAN · 55 min</span>
            <span className="name">Manchester Airport</span>
            <span className="p">£{tripType === "return" ? 150 : 75} {tripType === "return" ? "return" : "one way"}</span>
          </button>
        </div>
      </div>

      <div className={"field" + (errors.address ? " error" : "")}>
        <label>Home address <span className="req">*</span></label>
        <input type="text" placeholder="e.g. 14 Wellington Rd, Heswall CH60"
          value={form.address} onChange={e => upd("address", e.target.value)} />
        <div className="hint">{tripType === "return" ? "We pick up here on the way out, drop back here on the way home." : "Where we pick you up or drop you off."}</div>
        {errors.address && <div className="err-msg">{errors.address}</div>}
      </div>

      {tripType === "oneway" && (
        <div className="field">
          <label>Direction</label>
          <div className="dir-toggle" role="tablist">
            <button type="button" className={onewayDir === "to" ? "active" : ""} onClick={() => setOnewayDir("to")}>Home → Airport</button>
            <button type="button" className={onewayDir === "from" ? "active" : ""} onClick={() => setOnewayDir("from")}>Airport → Home</button>
          </div>
        </div>
      )}

      {tripType === "return" ? (
        <>
          <div className="leg-block">
            <div className="leg-head"><span className="leg-num">01</span><span className="leg-title">Outbound · Home → {airport}</span></div>
            <div className="row2">
              <div className={"field" + (errors.outDate ? " error" : "")}>
                <label>Pickup date <span className="req">*</span></label>
                <input type="date" value={form.outDate} min={new Date().toISOString().split('T')[0]} onChange={e => upd("outDate", e.target.value)} />
                {errors.outDate && <div className="err-msg">{errors.outDate}</div>}
              </div>
              <div className={"field" + (errors.outTime ? " error" : "")}>
                <label>Pickup time <span className="req">*</span></label>
                <input type="time" value={form.outTime} onChange={e => upd("outTime", e.target.value)} />
                {errors.outTime && <div className="err-msg">{errors.outTime}</div>}
              </div>
            </div>
            <div className="field">
              <label>Outbound flight no. <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
              <input type="text" placeholder="e.g. EZY7234" value={form.outFlight} onChange={e => upd("outFlight", e.target.value.toUpperCase())} />
            </div>
          </div>

          <div className="leg-block">
            <div className="leg-head"><span className="leg-num">02</span><span className="leg-title">Return · {airport} → Home</span></div>
            <div className="row2">
              <div className={"field" + (errors.retDate ? " error" : "")}>
                <label>Landing date <span className="req">*</span></label>
                <input type="date" value={form.retDate} min={new Date().toISOString().split('T')[0]} onChange={e => upd("retDate", e.target.value)} />
                {errors.retDate && <div className="err-msg">{errors.retDate}</div>}
              </div>
              <div className={"field" + (errors.retTime ? " error" : "")}>
                <label>Landing time <span className="req">*</span></label>
                <input type="time" value={form.retTime} onChange={e => upd("retTime", e.target.value)} />
                {errors.retTime && <div className="err-msg">{errors.retTime}</div>}
              </div>
            </div>
            <div className={"field" + (errors.retFlight ? " error" : "")}>
              <label>Return flight no. <span className="req">*</span></label>
              <input type="text" placeholder="e.g. BA2391" value={form.retFlight} onChange={e => upd("retFlight", e.target.value.toUpperCase())} />
              <div className="hint">We track it so we're there when you land — even if you're delayed.</div>
              {errors.retFlight && <div className="err-msg">{errors.retFlight}</div>}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="row2">
            <div className={"field" + (errors.legDate ? " error" : "")}>
              <label>{onewayDir === "to" ? "Pickup date" : "Landing date"} <span className="req">*</span></label>
              <input type="date" value={form.legDate} min={new Date().toISOString().split('T')[0]} onChange={e => upd("legDate", e.target.value)} />
              {errors.legDate && <div className="err-msg">{errors.legDate}</div>}
            </div>
            <div className={"field" + (errors.legTime ? " error" : "")}>
              <label>{onewayDir === "to" ? "Pickup time" : "Landing time"} <span className="req">*</span></label>
              <input type="time" value={form.legTime} onChange={e => upd("legTime", e.target.value)} />
              {errors.legTime && <div className="err-msg">{errors.legTime}</div>}
            </div>
          </div>
          <div className={"field" + (errors.legFlight ? " error" : "")}>
            <label>Flight number {onewayDir === "from" ? <span className="req">*</span> : <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>}</label>
            <input type="text" placeholder="e.g. BA2391" value={form.legFlight} onChange={e => upd("legFlight", e.target.value.toUpperCase())} />
            <div className="hint">We track it so we're there when you land — even if you're delayed.</div>
            {errors.legFlight && <div className="err-msg">{errors.legFlight}</div>}
          </div>
        </>
      )}

      <div className="row2">
        <div className="field">
          <label>Passengers</label>
          <div className="stepper">
            <button type="button" onClick={() => setPax(p => Math.max(1, p - 1))} disabled={pax <= 1}>−</button>
            <span className="val">{pax}</span>
            <button type="button" onClick={() => setPax(p => Math.min(7, p + 1))} disabled={pax >= 7}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Luggage</label>
          <div className="stepper">
            <button type="button" onClick={() => setBags(b => Math.max(0, b - 1))} disabled={bags <= 0}>−</button>
            <span className="val">{bags}</span>
            <button type="button" onClick={() => setBags(b => Math.min(8, b + 1))} disabled={bags >= 8}>+</button>
          </div>
        </div>
      </div>
      {pax > 4 && (
        <div className="field" style={{ marginTop: -8 }}>
          <div className="hint" style={{ color: "var(--amber-deep)", fontWeight: 500 }}>5+ passengers — we'll send our 7-seater at the same fixed price.</div>
        </div>
      )}

      <div className="row2">
        <div className={"field" + (errors.name ? " error" : "")}>
          <label>Your name <span className="req">*</span></label>
          <input type="text" placeholder="First and last" value={form.name} onChange={e => upd("name", e.target.value)} />
          {errors.name && <div className="err-msg">{errors.name}</div>}
        </div>
        <div className={"field" + (errors.phone ? " error" : "")}>
          <label>Mobile <span className="req">*</span></label>
          <input type="tel" placeholder="07..." value={form.phone} onChange={e => upd("phone", e.target.value)} />
          {errors.phone && <div className="err-msg">{errors.phone}</div>}
        </div>
      </div>

      <div className="field">
        <label>Email <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
        <input type="email" placeholder="for written confirmation" value={form.email} onChange={e => upd("email", e.target.value)} />
      </div>

      <div className="field">
        <label>Anything we should know? <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
        <textarea placeholder="Child seat, oversized luggage, gate code, mobility needs…"
          value={form.notes} onChange={e => upd("notes", e.target.value)} />
      </div>

      <div className="form-summary">
        <div>
          <div className="lbl">{tripType === "return" ? "Return · both legs" : "One way"} · {airport === "LJLA" ? "Liverpool John Lennon" : "Manchester"}</div>
          <div className="sub-text">{tripType === "return" ? `£${legPrice} out + £${legPrice} back · ` : ""}Includes meet & greet, tolls, waiting time</div>
        </div>
        <div className="total">£{price}</div>
      </div>

      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting ? (
          <span>Sending…</span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Book Now · £{price} <Icon name="arrow" size={16} />
          </span>
        )}
      </button>
      {submitError && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: "#fdecec", border: "1px solid #f5c2c2", color: "#8a2020", borderRadius: 10, fontSize: 13.5 }}>
          {submitError}
        </div>
      )}
      <div className="form-foot" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span><b style={{ color: "var(--navy-ink)" }}>Text confirmation in under 10 minutes.</b> No card needed — pay the driver on the day.</span>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--muted)" }}>
          <Icon name="shield" size={14} /> 100% Secure. No obligation. Your data is strictly protected.
        </span>
      </div>
    </form>
  );
}

/* ---------- BOOK SECTION ---------- */
function BookSection() {
  return (
    <section id="book" className="book-section">
      <div className="wrap book-grid">
        <div className="book-lead">
          <span className="section-kicker" style={{ color: "var(--amber)" }}>Book now</span>
          <h2>Get a driver confirmed in 10 minutes.</h2>
          <p>Fill the form and we'll text back with your driver's name and the fixed price — no card needed to reserve.</p>
          <div className="or-call">
            <span>Or book by phone</span>
            <a href="tel:+441511234567">0151 123 4567</a>
            <small>7 days · 6am to 11pm · a real person answers</small>
          </div>
        </div>
        <BookingForm />
      </div>
    </section>
  );
}

/* ---------- STICKY BAR ---------- */
function StickyBar({ enabled }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!enabled) { setShow(false); return; }
    function onScroll() {
      const y = window.scrollY;
      const hero = document.querySelector(".hero");
      const book = document.getElementById("book");
      if (!hero || !book) return;
      const past = y > hero.offsetHeight - 100;
      const rect = book.getBoundingClientRect();
      const inBook = rect.top < window.innerHeight && rect.bottom > 0;
      setShow(past && !inBook);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className={"sticky-bar" + (show ? " show" : "")}>
      <div className="sb-text">
        <b>LJLA £130 · MAN £150 return</b>
        <span>Both legs · meet & greet · no surge</span>
      </div>
      <a href="#book" className="btn btn-primary">Book Now</a>
    </div>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer>
      <div className="wrap foot-grid">
        <div>
          <div className="brand" style={{ marginBottom: 12 }}>
            <LogoMark size={56} />
          </div>
          <div className="foot-copy">Fixed-price airport transfers. Door to terminal, both ways. Licensed private hire · Est. 2011</div>
        </div>
        <div className="foot-links">
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="#reviews">Reviews</a>
          <a href="tel:+441511234567">0151 123 4567</a>
        </div>
      </div>
    </footer>
  );
}

/* ---------- APP ---------- */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply amber intensity via CSS var
  useEffect(() => {
    const map = {
      soft:     { amber: "#EFC977", deep: "#D4A542" },
      balanced: { amber: "#E6B24B", deep: "#C7932F" },
      vivid:    { amber: "#F2A93B", deep: "#B07D1F" }
    };
    const c = map[t.amberIntensity] || map.balanced;
    document.documentElement.style.setProperty("--amber", c.amber);
    document.documentElement.style.setProperty("--amber-deep", c.deep);
  }, [t.amberIntensity]);

  return (
    <>
      <Nav />
      <Hero headline={t.headline} />
      <AuthorityStrip />
      <HowItWorks />
      <FixedPricePromise />
      <MeetAndGreet />
      <FAQ />
      <Reviews />
      <BookSection />
      <Footer />
      <StickyBar enabled={t.showStickyBar} />

      <TweaksPanel>
        <TweakSection label="Copy" />
        <TweakRadio label="Hero headline" value={t.headline}
          options={["quiet", "direct", "local"]}
          onChange={v => setTweak("headline", v)} />

        <TweakSection label="Brand" />
        <TweakRadio label="Amber intensity" value={t.amberIntensity}
          options={["soft", "balanced", "vivid"]}
          onChange={v => setTweak("amberIntensity", v)} />

        <TweakSection label="Behaviour" />
        <TweakToggle label="Sticky book-bar on scroll" value={t.showStickyBar}
          onChange={v => setTweak("showStickyBar", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
