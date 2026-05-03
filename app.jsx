const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "headline": "quiet",
  "amberIntensity": "balanced",
  "showStickyBar": true,
  "imageStyle": "photo-placeholder"
}/*EDITMODE-END*/;

const HEADLINES = {
  quiet: { main: "Your holiday", accent: "starts here.", tail: "" },
  direct: { main: "Airport transfers,", accent: "both ways — fixed price.", tail: "" },
  local: { main: "Door to airport,", accent: "we'll be there when you land.", tail: "" }
};

/* ══════════ PRICING ENGINE ══════════ */
const FIXED_FARES = {
  LJLA:        { car: 55, mpv: 65, '8seat': 78 },
  MAN:         { car: 75, mpv: 88, '8seat': 100 },
  LJLA_WIRRAL: { car: 65, mpv: 75, '8seat': 88 },
  MAN_WIRRAL:  { car: 75, mpv: 88, '8seat': 100 },
};
const DOUBLE_TIME_DATES = ['12-24','12-25','12-26','12-31','01-01'];
const VEHICLE_SHORT = { car: 'Car', mpv: 'MPV', '8seat': '8 Seater' };
const VEHICLE_RANK  = { car: 0, mpv: 1, '8seat': 2 };

/* ── SERVICE AREA: 10-mile radius around Knowsley ── */
const KNOWSLEY = { lat: 53.4547, lon: -2.8330 };
const SERVICE_RADIUS_MI = 10.0;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInServiceArea(lat, lon) {
  if (lat == null || lon == null) return true; // no coords yet = don't block
  return haversine(KNOWSLEY.lat, KNOWSLEY.lon, lat, lon) <= SERVICE_RADIUS_MI;
}

/* Wirral postcodes start CH41–CH66 (Merseyside side) */
const WIRRAL_CH = /^CH(4[1-9]|[5-6][0-9])\b/i;

function isWirralAddress(addressObj, postcode) {
  if (postcode && WIRRAL_CH.test(postcode.replace(/\s/g, ''))) return true;
  if (!addressObj) return false;
  const fields = [addressObj.county, addressObj.borough, addressObj.state_district, addressObj.city_district].filter(Boolean);
  return fields.some(f => /wirral/i.test(f));
}

function getFareKey(airport, wirral) {
  return wirral ? airport + '_WIRRAL' : airport;
}

/* Vehicle limits: max large suitcases & cabin bags per type */
const VEHICLE_LIMITS = {
  car:   { pax: 3, large: 2, cabin: 2 },
  mpv:   { pax: 5, large: 5, cabin: 5 },
  '8seat': { pax: 8, large: 8, cabin: 8 },
};

/* Special items → equivalent large-suitcase count */
const SPECIAL_EQUIV = { pushchair: 1, wheelchair: 2, golfBag: 2, bike: 3 };

function specialToLarge(specials) {
  return Object.entries(specials).reduce((sum, [k, v]) => sum + (SPECIAL_EQUIV[k] || 0) * v, 0);
}

function getAutoVehicle(pax, largeBags, cabinBags, specials) {
  const totalLarge = largeBags + specialToLarge(specials || {});
  // Pax-based floor
  let v = pax > 5 ? '8seat' : pax > 3 ? 'mpv' : 'car';
  // Luggage upgrade: if car, check fits
  if (v === 'car') {
    if (totalLarge > VEHICLE_LIMITS.car.large || cabinBags > VEHICLE_LIMITS.car.cabin) v = 'mpv';
  }
  // If MPV, check fits
  if (v === 'mpv') {
    if (totalLarge > VEHICLE_LIMITS.mpv.large || cabinBags > VEHICLE_LIMITS.mpv.cabin) v = '8seat';
  }
  return v;
}

function isDoubleTime(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return DOUBLE_TIME_DATES.includes(mm + '-' + dd);
}
function getHolidayMult(dateStr, bankHols) {
  if (!dateStr) return 1;
  if (isDoubleTime(dateStr)) return 2;
  if (bankHols && bankHols.includes(dateStr)) return 1.5;
  return 1;
}

function buildQuote({ airport, fareKey, vehicle, tripType, dates, bankHols }) {
  const fixed = FIXED_FARES[fareKey || airport];
  if (!fixed) return null;
  const base = fixed[vehicle];
  if (base == null) return null;
  const legs = [];
  if (tripType === 'return') {
    const om = getHolidayMult(dates.outDate, bankHols);
    const rm = getHolidayMult(dates.retDate, bankHols);
    legs.push({ label: 'Outbound', base, mult: om, price: Math.ceil(base * om * 100) / 100 });
    legs.push({ label: 'Return',   base, mult: rm, price: Math.ceil(base * rm * 100) / 100 });
  } else {
    const m = getHolidayMult(dates.legDate, bankHols);
    legs.push({ label: 'One way', base, mult: m, price: Math.ceil(base * m * 100) / 100 });
  }
  const total = legs.reduce((s, l) => s + l.price, 0);
  return { vehicle, vehicleLabel: VEHICLE_SHORT[vehicle], legs, total: Math.round(total * 100) / 100, fixedFare: true, hasHoliday: legs.some(l => l.mult > 1) };
}

/* ══════════ QUOTE PANEL ══════════ */
function QuotePanel({ quote }) {
  if (!quote) return null;
  return (
    <div className="quote-panel">
      <div className="quote-hdr">
        <div className="quote-vehicle-badge"><Icon name="shield" size={16} /><span>{quote.vehicleLabel}</span></div>
        <span className="quote-fixed-tag">Fixed price</span>
      </div>
      <div className="quote-rows">
        {quote.legs.map((leg, i) => (
          <div className="quote-row" key={i}>
            <span className="quote-leg-lbl">{leg.label}</span>
            {leg.mult > 1 && <span className="quote-surcharge">{leg.mult === 2 ? 'Double time' : 'Bank hol.'} ×{leg.mult}</span>}
            <span className="quote-leg-price">£{leg.price.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="quote-total-row"><span>Total</span><span className="quote-total">£{quote.total.toFixed(2)}</span></div>
      <div className="quote-trust-line"><Icon name="check" size={14} /> Includes parking, tolls &amp; VAT — no hidden fees</div>
      {quote.hasHoliday && <div className="quote-hol-note">Holiday rate applied. Standard pricing on regular days.</div>}
    </div>
  );
}

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
          <a href="#book" className="btn btn-primary btn-sm">Quick Quote</a>
        </div>
      </div>
    </nav>
  );
}

/* ---------- AURORA BACKGROUND ---------- */
function AuroraBackground({ children, showRadialGradient = true, className = "" }) {
  return (
    <div className={`aurora-container ${className}`} style={{ padding: 0, width: "100%", height: "100%", background: "transparent" }}>
      <div className="aurora-bg-wrapper">
        <div className={`aurora-effect ${showRadialGradient ? 'radial' : ''}`}></div>
      </div>
      <div className="aurora-content" style={{ width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- HERO ---------- */
function Hero({ headline }) {
  const h = HEADLINES[headline] || HEADLINES.quiet;
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    tryPlay();
    // Retry once the main thread is free again (a long-running
    // extension content-script can starve the initial play()).
    const onPageShow = () => tryPlay();
    window.addEventListener('pageshow', onPageShow);
    const onClick = () => tryPlay();
    window.addEventListener('pointerdown', onClick, { once: true });
    // Chrome's "Pause video-only background media to save power"
    // intervention pauses muted, audio-less videos when the tab
    // becomes hidden (alt-tab, occluded window, etc.) and never
    // resumes them. Resume manually when the tab becomes visible.
    const onVisibility = () => { if (!document.hidden && v.paused) tryPlay(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pointerdown', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <header className="hero hero-video">
      {/* Video background */}
      <video
        ref={videoRef}
        className="hero-video-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={{ background: '#0E2747' }}
      >
        <source src="./assets/hero-bg-compressed-no-sound.mp4" type="video/mp4" />
      </video>
      <div className="hero-video-overlay"></div>

      <div className="wrap hero-video-content">
        <h1 className="sr-only">Airport Transfers Liverpool</h1>
        <div className="h1 hero-video-h1" aria-hidden="true">
          {h.main} <em>{h.accent}</em>
          {h.tail && <><br /><span className="hero-tail">{h.tail}</span></>}
        </div>
        <p className="sub hero-video-sub">
          Private airport transfers from your front door to Liverpool John Lennon or Manchester Airport. Fixed price once quoted, both legs. No hidden fees, no meter, no surprises.
        </p>

        <div className="hero-prices hero-video-prices" id="prices">
          <div className="price-card hero-price-card">
            <div>
              <div className="route">Liverpool John Lennon</div>
              <div className="airport">LJLA</div>
            </div>
            <div className="amt">From £55<small>each way</small></div>
          </div>
          <div className="price-card hero-price-card">
            <div>
              <div className="route">Manchester Airport</div>
              <div className="airport">MAN</div>
            </div>
            <div className="amt">From £75<small>each way</small></div>
          </div>
        </div>

        <div className="hero-cta" style={{ flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <a href="#book" className="btn btn-primary" style={{ padding: "16px 32px", fontSize: "16px", width: "100%", maxWidth: "520px", justifyContent: "center" }}>
            Quick Quote & Book Online <Icon name="arrow" size={16} />
          </a>
        </div>

        <div className="trust hero-video-trust" style={{ marginTop: "24px" }}>
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
    </header>
  );
}

/* ---------- HOW IT WORKS ---------- */
function HowItWorks() {
  const steps = [
    { n: 1, title: "Book both legs at once", body: "Tell us your pickup address and flight times — out and back. One booking, one fixed price for your vehicle. Confirmation text arrives shortly.", time: "~2 min to book" },
    { n: 2, title: "Your private vehicle arrives", body: "Driver rings the bell at the agreed time. Bags in the boot, dropped at the terminal door. No airport parking to find.", time: "Direct to the terminal door" },
    { n: 3, title: "We meet you when you land", body: "Your driver waits inside Arrivals with a sign showing your name. We track your flight so they're there whether you're early, late or delayed.", time: "inside the terminal" }
  ];
  return (
    <section id="how" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
      <AuroraBackground>
        <div className="wrap" style={{ paddingTop: '64px', paddingBottom: '64px' }}>
          <div className="section-head">
            <span className="section-kicker">From your door to the terminal. And back.</span>
            <h2 className="h2">Three steps. <em>No faff.</em></h2>
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
      </AuroraBackground>
    </section>
  );
}

/* ---------- PROMISE ---------- */
function FixedPricePromise() {
  const items = [
    { title: "Fixed prices, always", body: "Friday 5pm, Christmas morning, bank holiday — your quoted price won't change. No surge pricing." },
    { title: "No extras for flight delays", body: "We track your flight. If you're late, we wait. You don't pay a penny more." },
    { title: "No hidden fees", body: "The price you're quoted includes parking, tolls and VAT. That's the lot." },
    { title: "Cancel free up to 24 hrs", body: "Plans change. We get it. No cancellation fee outside 24 hours of pickup." }
  ];
  return (
    <section className="cream">
      <div className="wrap">
        <div className="promise">
          <div className="promise-grid">
            <div>
              <span className="section-kicker" style={{ color: "var(--amber)" }}>The fixed-price promise</span>
              <h2 className="h2">The price we quote <em>is the price you pay.</em></h2>
              <p className="sub-light">We've watched people get stung by £90 Ubers at midnight and £200 airport car parks for a long weekend. We offer fixed pricing based on the vehicle you need — no meters, no hidden fees.</p>
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

/* ---------- YOUR VEHICLE ---------- */
function YourVehicle() {
  return (
    <section>
      <div className="wrap mng-grid">
        <div>
          <span className="section-kicker">Your vehicle</span>
          <h2 className="h2">Private airport transfers. <em>Fixed pricing.</em></h2>
          <p className="section-sub" style={{ marginBottom: '24px' }}>Every booking travels in a private vehicle tailored to your group size. Whether it's a car, an MPV, or a spacious 8-seat minibus, you'll have room for everyone and everything.</p>
          <ul className="mng-list">
            <li>
              <div className="ic"><Icon name="luggage" size={20} /></div>
              <div><b>Room for up to 8 passengers + luggage</b><span>Whether you're travelling solo or as a group of eight, we'll send the right vehicle to fit everyone comfortably.</span></div>
            </li>
            <li>
              <div className="ic"><Icon name="shield" size={20} /></div>
              <div><b>Private hire licensed</b><span>Fully licensed, DBS-checked drivers and £5M public liability insurance. Every trip, every time.</span></div>
            </li>
            <li>
              <div className="ic"><Icon name="pound" size={20} /></div>
              <div><b>Clear pricing based on vehicle size</b><span>Prices start at £55 to LJLA or £75 to Manchester. Split it between your group and it's cheaper than the bus.</span></div>
            </li>
          </ul>
          <a href="#book" className="btn btn-primary" style={{ marginTop: '24px' }}>Book Your Transfer <Icon name="arrow" size={16} /></a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src="./assets/airport-transfers-fleet.jpg" 
            alt="RM Transfers fleet" 
            style={{ width: '100%', height: 'auto', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------- MEET AND GREET ---------- */
function MeetAndGreet() {
  return (
    <section className="bg-light">
      <div className="wrap mng-grid">
        <div className="mng-media" role="img" aria-label="Driver waiting in airport arrivals area" style={{ backgroundImage: "url('./assets/airport-arrivals-greet.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}>
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
          <span className="section-kicker">Both ways, fully managed</span>
          <h2 className="h2">We pick you up at home. <em>We meet you in Arrivals.</em></h2>
          <p className="section-sub">Most of our bookings are returns — both legs managed by our team so you're never explaining yourself twice. Door to terminal on the way out. Terminal to door on the way back.</p>
          <ul className="mng-list">
            <li>
              <div className="ic"><Icon name="track" size={20} /></div>
              <div><b>Live flight tracking on the return</b><span>We check your flight the night before and the hour you land. Early, late or delayed — your driver is already there waiting.</span></div>
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

  const observerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("bento-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    
    if (observerRef.current) {
      const elements = observerRef.current.querySelectorAll('.bento-item');
      elements.forEach((el, index) => {
        el.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(el);
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="reviews" ref={observerRef}>
      <div className="wrap">
        <div className="section-head reviews-head">
          <span className="section-kicker">What our customers say</span>
          <h2 className="h2">Booked, tracked, arrived — <em>on repeat.</em></h2>
          <div className="score">
            <div className="num">4.9</div>
            <div>
              <div className="stars">★★★★★</div>
              <div className="score-meta"><b>380+ reviews</b> across Google & Trustpilot</div>
            </div>
          </div>
        </div>
        
        <div className="bento-grid">
          {/* Column 1 */}
          <div className="bento-col">
            <div className="bento-item bento-item-large bento-bg-cream">
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16 }}>★★★★★</div>
                <p style={{ flex: 1, fontSize: 16 }}>"{items[0].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber)', color: 'var(--navy-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[0].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: 'var(--navy-ink)', fontSize: 15 }}>{items[0].name}</b>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{items[0].when}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bento-item bento-item-small bento-bg-navy">
              <div className="bento-dot-pattern"></div>
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16, color: 'var(--amber)' }}>★★★★★</div>
                <p style={{ flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 15 }}>"{items[1].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[1].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: '#fff', fontSize: 15 }}>{items[1].name}</b>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{items[1].when}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="bento-col">
            <div className="bento-item bento-item-small bento-bg-white">
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16, color: 'var(--amber-deep)' }}>★★★★★</div>
                <p style={{ flex: 1, fontSize: 15 }}>"{items[2].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--cream)', color: 'var(--navy-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[2].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: 'var(--navy-ink)', fontSize: 15 }}>{items[2].name}</b>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{items[2].when}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bento-item bento-item-large bento-bg-amber">
              <div className="bento-dot-pattern" style={{ backgroundImage: 'radial-gradient(rgba(14, 39, 71, 0.08) 2px, transparent 2px)' }}></div>
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16, color: 'var(--navy-ink)' }}>★★★★★</div>
                <p style={{ flex: 1, color: 'var(--navy-ink)', fontWeight: 500, fontSize: 16 }}>"{items[3].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--navy-ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[3].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: 'var(--navy-ink)', fontSize: 15 }}>{items[3].name}</b>
                    <span style={{ fontSize: 13, color: 'rgba(14, 39, 71, 0.7)' }}>{items[3].when}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="bento-col">
            <div className="bento-item bento-item-large bento-bg-navy">
              <div className="bento-dot-pattern"></div>
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16, color: 'var(--amber)' }}>★★★★★</div>
                <p style={{ flex: 1, color: 'rgba(255,255,255,0.95)', fontSize: 16 }}>"{items[4].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[4].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: '#fff', fontSize: 15 }}>{items[4].name}</b>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{items[4].when}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bento-item bento-item-small bento-bg-cream">
              <div className="bento-content">
                <div className="stars" style={{ marginBottom: 16 }}>★★★★★</div>
                <p style={{ flex: 1, fontSize: 15 }}>"{items[5].text}"</p>
                <div className="review-by" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="av" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber)', color: 'var(--navy-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{items[5].init}</div>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ color: 'var(--navy-ink)', fontSize: 15 }}>{items[5].name}</b>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{items[5].when}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQ() {
  const items = [
    { q: "Can I book the outbound and return together?", a: "Yes — and honestly, most people do. One booking, one fixed price for both legs. You only need to give us your flight numbers and we'll take care of the rest." },
    { q: "How do I know the driver will actually turn up?", a: "Every booking gets a confirmation text shortly after with your driver's name and the vehicle. The night before pickup we send a reminder. The morning of, your driver messages you directly. If that sounds like a lot of texts — it's deliberate. It's the bit Uber doesn't do." },
    { q: "What happens if my flight is delayed?", a: "We check your flight number before leaving to collect you. If you're delayed, we delay. There's no extra charge — the fixed price covers up to 60 minutes of waiting in Arrivals, and honestly we've waited longer without ever billing for it. Fixed price means fixed price." },
    { q: "What if I'm not ready when you arrive at home?", a: "Fine. We build a few minutes' grace into every pickup, and we'd rather be early than late. Just tell us what time you want to leave the house and we'll plan back from that." },
    { q: "Are your drivers licensed and insured?", a: "Yes — every driver is fully licensed by the local council for private hire, DBS checked, and the business carries full public liability and hire & reward insurance. Happy to show you the paperwork before booking if you'd like." },
    { q: "Will my luggage fit?", a: "We allocate vehicles based on your passenger count and luggage needs — ranging from standard cars to spacious 8-seat minibuses. We make sure there's plenty of room for everyone and everything." },
    { q: "How do I pay?", a: "Once you've received your quote, you'll pay securely online via Stripe Checkout — right there on the website. Your booking is confirmed instantly once payment is complete." },
    { q: "How far ahead do I need to book?", a: "Ideally 24 hours for guaranteed availability. We often take same-day bookings when a driver's free — call 0151 453 3607 and we'll tell you straight." }
  ];
  return (
    <section id="faq" className="cream">
      <div className="wrap">
        <div className="section-head">
          <span className="section-kicker">Common questions</span>
          <h2 className="h2">The things people <em>actually worry about.</em></h2>
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
  const [largeBags, setLargeBags] = useState(1);
  const [cabinBags, setCabinBags] = useState(1);
  const [specials, setSpecials] = useState({ pushchair: 0, wheelchair: 0, golfBag: 0, bike: 0 });
  const [vehicleOverride, setVehicleOverride] = useState(null);
  const [bankHols, setBankHols] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [bookingRef, setBookingRef] = useState("");
  const [errors, setErrors] = useState({});
  const [addressCoords, setAddressCoords] = useState(null); // { lat, lon }
  const [addressData, setAddressData] = useState(null);     // Nominatim address obj

  const autoVehicle = getAutoVehicle(pax, largeBags, cabinBags, specials);
  const vehicle = vehicleOverride && VEHICLE_RANK[vehicleOverride] >= VEHICLE_RANK[autoVehicle] ? vehicleOverride : autoVehicle;

  useEffect(() => {
    if (vehicleOverride && VEHICLE_RANK[vehicleOverride] < VEHICLE_RANK[getAutoVehicle(pax, largeBags, cabinBags, specials)]) setVehicleOverride(null);
  }, [pax, largeBags, cabinBags, specials]);

  useEffect(() => {
    fetch('https://www.gov.uk/bank-holidays.json').then(r => r.json()).then(d => setBankHols((d['england-and-wales']?.events || []).map(e => e.date))).catch(() => {});
  }, []);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    address: "",
    // outbound (home → airport)
    outDate: "", outTime: "", outFlight: "",
    // return (airport → home)
    retDate: "", retTime: "", retFlight: "",
    // single-leg (oneway)
    legDate: "", legTime: "", legFlight: "",
    notes: "", promoCode: ""
  });

  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const skipSearchRef = useRef(false);

  /* ── Derived: Wirral, service area, short notice ── */
  const wirral = useMemo(() => {
    if (!addressData) return false;
    return isWirralAddress(addressData, addressData.postcode);
  }, [addressData]);

  const inArea = useMemo(() => {
    if (!addressCoords) return true; // no selection yet = allow
    return isInServiceArea(addressCoords.lat, addressCoords.lon);
  }, [addressCoords]);

  const shortNotice = useMemo(() => {
    const now = Date.now();
    const minMs = 24 * 60 * 60 * 1000;
    if (tripType === 'return') {
      if (form.outDate && form.outTime) {
        const dt = new Date(`${form.outDate}T${form.outTime}`).getTime();
        if (dt - now < minMs) return true;
      }
    } else {
      if (form.legDate && form.legTime) {
        const dt = new Date(`${form.legDate}T${form.legTime}`).getTime();
        if (dt - now < minMs) return true;
      }
    }
    return false;
  }, [tripType, form.outDate, form.outTime, form.legDate, form.legTime]);

  const fareKey = getFareKey(airport, wirral);
  const showCallToBook = (addressCoords && !inArea) || shortNotice;

  const quote = useMemo(() => {
    if (showCallToBook) return null; // no quote when call-to-book is active
    const dates = tripType === 'return' ? { outDate: form.outDate, retDate: form.retDate } : { legDate: form.legDate };
    return buildQuote({ airport, fareKey, vehicle, tripType, dates, bankHols });
  }, [airport, fareKey, vehicle, tripType, form.outDate, form.retDate, form.legDate, bankHols, showCallToBook]);

  useEffect(() => {
    if (!form.address || form.address.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.address)}&format=json&addressdetails=1&countrycodes=gb&limit=5`, {
          headers: { "Accept-Language": "en-GB,en;q=0.9" }
        });
        if (res.ok) {
          const data = await res.json();
          setAddressSuggestions(Array.isArray(data) ? data : []);
          setShowAddressSuggestions(true);
        }
      } catch (err) {
        console.error("Autolookup error", err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.address]);

  const formatAddress = (s, currentQuery) => {
    const parts = [];
    let houseNumber = s.address?.house_number;
    
    // Preserve house number from user's input if Nominatim omits it
    if (!houseNumber && currentQuery) {
      const match = currentQuery.trim().match(/^(\d+[a-zA-Z]?(-\d+[a-zA-Z]?)?)\s/);
      if (match) {
        houseNumber = match[1];
      }
    }

    if (s.address) {
      if (houseNumber) parts.push(houseNumber);
      if (s.address.road) parts.push(s.address.road);
      if (s.address.suburb) parts.push(s.address.suburb);
      if (s.address.city || s.address.town || s.address.village) parts.push(s.address.city || s.address.town || s.address.village);
      if (s.address.postcode) parts.push(s.address.postcode);
    }
    
    if (parts.length > 0) return parts.join(', ');
    
    let display = s.display_name.replace(', United Kingdom', '');
    if (houseNumber && !display.startsWith(houseNumber)) {
      display = houseNumber + ' ' + display;
    }
    return display;
  };

  // Prices will be manually quoted

  function upd(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  }

  async function submit(e) {
    e.preventDefault();
    if (showCallToBook) return; // safety guard
    console.log("[booking] submit fired");
    const errs = {};
    if (!form.name.trim()) errs.name = "We need a name to greet you with";
    if (!form.phone.trim()) errs.phone = "So we can text you the driver's details";
    if (!form.address.trim()) errs.address = "Home address please — where we pick up & drop off";

    if (tripType === "return") {
      if (!form.outDate) errs.outDate = "Outbound date";
      if (!form.outTime) errs.outTime = "Pickup time";
      if (!form.retDate) errs.retDate = "Return date";
      if (!form.retTime) errs.retTime = "Landing time";
      if (!form.retFlight.trim()) errs.retFlight = "So we can track your return flight";
    } else {
      if (!form.legDate) errs.legDate = "Pick a date";
      if (!form.legTime) errs.legTime = "Pick a time";
      if (onewayDir === "from" && !form.legFlight.trim()) errs.legFlight = "So we can track it";
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
      largeBags,
      cabinBags,
      specials,
      vehicleType: vehicle,
      vehicleLabel: VEHICLE_SHORT[vehicle],
      source: "website_v2",
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim()
      },
      quote: quote ? {
        vehicleType: quote.vehicle,
        vehicleLabel: quote.vehicleLabel,
        perLeg: quote.legs[0].base,
        legs: quote.legs.map(l => ({ label: l.label, price: l.price, multiplier: l.mult })),
        totalPrice: quote.total,
        fixedFare: quote.fixedFare,
        hasHolidaySurcharge: quote.hasHoliday,
      } : null,
      outbound: tripType === "return"
        ? { date: form.outDate, time: form.outTime, flight: form.outFlight.trim() || null }
        : (onewayDir === "to" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() || null } : null),
      return: tripType === "return"
        ? { date: form.retDate, time: form.retTime, flight: form.retFlight.trim() }
        : (onewayDir === "from" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() } : null),
      notes: form.notes.trim() || null,
      pageUrl: typeof window !== "undefined" ? window.location.href : null
    };

    console.log("[booking] Creating Airtable record directly", payload);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Build Airtable fields from the booking payload
      const outbound = tripType === "return"
        ? { date: form.outDate, time: form.outTime, flight: form.outFlight.trim() || null }
        : (onewayDir === "to" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() || null } : null);
      const returnLeg = tripType === "return"
        ? { date: form.retDate, time: form.retTime, flight: form.retFlight.trim() }
        : (onewayDir === "from" ? { date: form.legDate, time: form.legTime, flight: form.legFlight.trim() } : null);

      const airtableFields = {
        'Booking Ref': ref,
        'Customer Name': form.name.trim(),
        'Customer Phone': form.phone.trim(),
        'Customer Email': form.email.trim() || '',
        'Home Address': form.address.trim(),
        'Trip Type': tripType,
        'Airport': airport === "LJLA" ? "Liverpool John Lennon" : "Manchester",
        'Passengers': pax,
        'Luggage': largeBags,
        'Customer Price': quote ? quote.total : 0,
        // Default Operator Price to the same figure so Profit starts at £0
        // and admin only has to type the operator rate when it differs.
        'Operator Price': quote ? quote.total : 0,
        'Notes': form.notes.trim() || '',
        'Status': 'Pending',
        'Submitted At': new Date().toISOString(),
      };
      if (tripType === "oneway") {
        airtableFields['Oneway Direction'] = onewayDir;
      }
      if (outbound) {
        airtableFields['Outbound Date'] = outbound.date;
        airtableFields['Outbound Time'] = outbound.time;
        if (outbound.flight) airtableFields['Outbound Flight'] = outbound.flight;
      }
      if (returnLeg) {
        airtableFields['Return Date'] = returnLeg.date;
        airtableFields['Return Time'] = returnLeg.time;
        if (returnLeg.flight) airtableFields['Return Flight'] = returnLeg.flight;
      }

      const res = await fetch("/api/booking?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: airtableFields, typecast: true })
      });
      console.log("[booking] API response", res.status);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[booking] API error:", errBody);
        throw new Error("Booking API responded " + res.status + ": " + (errBody.error || "unknown"));
      }

      // If we have a quote, redirect to Stripe Checkout for immediate payment.
      // No SMS fires here — the Stripe webhook handles notifications after payment.
      if (quote && quote.total > 0) {
        console.log("[booking] creating Stripe Checkout session...");
        const tripSummary = tripType === "return"
          ? `Return · ${airport === "LJLA" ? "Liverpool John Lennon" : "Manchester"} · ${VEHICLE_SHORT[vehicle]}`
          : `One-way ${onewayDir === "to" ? "→" : "←"} ${airport === "LJLA" ? "Liverpool John Lennon" : "Manchester"} · ${VEHICLE_SHORT[vehicle]}`;
        
        const checkoutRes = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            amount: quote.total,
            customerName: form.name.trim(),
            customerEmail: form.email.trim() || null,
            customerPhone: form.phone.trim(),
            tripSummary,
            vehicleType: VEHICLE_SHORT[vehicle],
            tripType,
            promoCode: form.promoCode.trim() || null,
          })
        });

        if (!checkoutRes.ok) {
          const errData = await checkoutRes.json().catch(() => ({}));
          throw new Error(errData.error || "Checkout session failed");
        }

        const { url } = await checkoutRes.json();
        console.log("[booking] redirecting to Stripe Checkout:", url);
        window.location.href = url;
      } else {
        // Fallback: no quote (shouldn't happen normally) — go to thank-you
        const emailFlag = form.email && form.email.trim() ? `&email=1` : "";
        window.location.href = `/thank-you/?ref=${ref}&type=${tripType}${emailFlag}`;
      }
    } catch (err) {
      console.error("[booking] submit error", err);
      if (err.message && err.message.includes("Invalid promo code")) {
        setSubmitError(err.message);
      } else {
        setSubmitError("We couldn't send that just now. Please call 0151 453 3607 or try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="book-form">
        <div className="book-success">
          <div className="check"><Icon name="check" size={32} /></div>
          <h3>Booking confirmed!</h3>
          <p>Your payment is being processed and we're now preparing your transfer{tripType === "return" ? " for both legs" : ""}. We'll send your booking details to you soon by text message{form.email && form.email.trim() ? " and email" : ""}.</p>
          <div className="ref" id="book-ref" tabIndex={-1}>Ref: {bookingRef} · {tripType === "return" ? "return" : "one-way"}</div>
          <div style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
            Need to change something? Call us on 0151 453 3607.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="book-form" onSubmit={submit} noValidate>
      <h3>Book your transfer</h3>
      <p className="form-sub">Get your fixed price instantly — book and pay online.</p>

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
            <span className="code">LJLA</span>
            <span className="name">Liverpool John Lennon</span>
          </button>
          <button type="button" className={airport === "MAN" ? "active" : ""} onClick={() => setAirport("MAN")}>
            <span className="code">MAN</span>
            <span className="name">Manchester Airport</span>
          </button>
        </div>
      </div>

      <div className={"field" + (errors.address ? " error" : "")} style={{ position: "relative" }}>
        <label>Home address <span className="req">*</span></label>
        <input type="text" placeholder="e.g. 14 Wellington Rd, Heswall CH60"
          value={form.address} 
          onChange={e => {
            upd("address", e.target.value);
            setAddressCoords(null);
            setAddressData(null);
            setShowAddressSuggestions(true);
          }}
          onFocus={() => setShowAddressSuggestions(true)}
          onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
          autoComplete="off"
        />
        {showAddressSuggestions && addressSuggestions.length > 0 && (
          <div className="autocomplete-suggestions" style={{
            position: "absolute", top: "100%", left: 0, right: 0, 
            background: "#fff", border: "1px solid var(--line)", borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, overflow: "hidden",
            marginTop: "4px"
          }}>
            {addressSuggestions.map((s, i) => {
              const formatted = formatAddress(s, form.address);
              return (
                <div key={i} style={{
                  padding: "10px 12px", cursor: "pointer", borderBottom: i < addressSuggestions.length - 1 ? "1px solid var(--line)" : "none",
                  fontSize: "14px", color: "var(--ink)", transition: "background 0.2s"
                }}
                onMouseDown={() => {
                  skipSearchRef.current = true;
                  upd("address", formatted);
                  setAddressCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
                  setAddressData(s.address || null);
                  setShowAddressSuggestions(false);
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--cream)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ fontWeight: 500 }}>{formatted.split(',')[0]}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                    {formatted.split(',').slice(1).join(',')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      <div className="field">
        <label>Passengers</label>
        <div className="stepper">
          <button type="button" onClick={() => setPax(p => Math.max(1, p - 1))} disabled={pax <= 1}>−</button>
          <span className="val">{pax}</span>
          <button type="button" onClick={() => setPax(p => Math.min(8, p + 1))} disabled={pax >= 8}>+</button>
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Large suitcases</label>
          <div className="stepper">
            <button type="button" onClick={() => setLargeBags(b => Math.max(0, b - 1))} disabled={largeBags <= 0}>−</button>
            <span className="val">{largeBags}</span>
            <button type="button" onClick={() => setLargeBags(b => Math.min(10, b + 1))} disabled={largeBags >= 10}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Cabin bags</label>
          <div className="stepper">
            <button type="button" onClick={() => setCabinBags(b => Math.max(0, b - 1))} disabled={cabinBags <= 0}>−</button>
            <span className="val">{cabinBags}</span>
            <button type="button" onClick={() => setCabinBags(b => Math.min(10, b + 1))} disabled={cabinBags >= 10}>+</button>
          </div>
        </div>
      </div>

      {/* Special items */}
      <div className="field">
        <label>Special items <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
        <div className="special-items-grid">
          {[['pushchair','Pushchair','= 1 suitcase'],['wheelchair','Wheelchair','= 2 suitcases'],['golfBag','Golf bag','= 2 suitcases'],['bike','Bike','= 3 suitcases']].map(([key, label, eq]) => (
            <div className={`special-item${specials[key] > 0 ? ' active' : ''}`} key={key}>
              <div className="special-item-info">
                <span className="special-item-label">{label}</span>
                <span className="special-item-eq">{eq}</span>
              </div>
              <div className="stepper stepper-sm">
                <button type="button" onClick={() => setSpecials(s => ({...s, [key]: Math.max(0, s[key]-1)}))} disabled={specials[key] <= 0}>−</button>
                <span className="val">{specials[key]}</span>
                <button type="button" onClick={() => setSpecials(s => ({...s, [key]: Math.min(4, s[key]+1)}))}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vehicle type */}
      <div className="field">
        <label>Vehicle type</label>
        <div className="vehicle-select">
          {['car', 'mpv', '8seat'].map(v => {
            const tooSmall = VEHICLE_RANK[v] < VEHICLE_RANK[autoVehicle];
            const active = v === vehicle;
            return (
              <button key={v} type="button"
                className={`vehicle-opt${active ? ' active' : ''}${tooSmall ? ' disabled' : ''}`}
                disabled={tooSmall}
                onClick={() => setVehicleOverride(v === autoVehicle ? null : v)}
              >
                <span className="vehicle-opt-name">{VEHICLE_SHORT[v]}</span>
                <span className="vehicle-opt-pax">{v === 'car' ? '1–3 pax' : v === 'mpv' ? '4–5 pax' : '6–8 pax'}</span>
                {v === autoVehicle && <span className="vehicle-opt-rec">Recommended</span>}
              </button>
            );
          })}
        </div>
      </div>

      {showCallToBook ? (
        <div className="call-to-book" style={{
          margin: '24px 0', padding: '28px 24px', borderRadius: '14px',
          background: 'linear-gradient(135deg, #0E2747 0%, #1a3a5c 100%)',
          textAlign: 'center', color: '#fff'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}><Icon name="phone" size={32} color="#E5A54B" /></div>
          <h4 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Call to Book</h4>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
            {!inArea && addressCoords
              ? 'Your pickup is outside our instant-quote service area.'
              : 'Bookings within 24 hours require a quick call for availability.'}
            <br />Please call us directly — we'll get you sorted.
          </p>
          <a href="tel:01514533607" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '14px 32px', borderRadius: '10px',
            background: '#E5A54B', color: '#0E2747', fontWeight: 700,
            fontSize: 17, textDecoration: 'none', transition: 'transform 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          ><Icon name="phone" size={18} color="#0E2747" /> 0151 453 3607</a>
          <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            Lines open 7 days · 6am – 10pm
          </div>
        </div>
      ) : (
        <>
          <QuotePanel quote={quote} />

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
            <textarea placeholder="Extra pickup stops (e.g. collecting friends/family on the way — please include addresses), child seat, oversized luggage, gate code, mobility needs…"
              value={form.notes} onChange={e => upd("notes", e.target.value)} />
            <div className="field-hint" style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.45 }}>
              Please mention any additional pickup or drop-off stops (e.g. collecting other passengers en route). Multi-stop journeys can affect the final price — we'll confirm the quoted fare with you before payment.
            </div>
          </div>

          <div className="field">
            <label>Promo code <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
            <input type="text" placeholder="Enter code if you have one" value={form.promoCode} onChange={e => upd("promoCode", e.target.value.toUpperCase())} />
          </div>

          <div className="form-summary">
            <div>
              <div className="lbl">{tripType === "return" ? "Return · both legs" : "One way"} · {airport === "LJLA" ? "Liverpool John Lennon" : "Manchester"}</div>
              <div className="sub-text">Includes tolls and waiting time</div>
            </div>
            {quote && <div className="total">£{quote.total.toFixed(2)}</div>}
          </div>

          <button type="submit" className="form-submit" disabled={submitting}>
            {submitting ? (
              <span>Sending…</span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                {quote ? `Book & Pay — £${quote.total.toFixed(2)}` : 'Quick Quote & Book Online'} <Icon name="arrow" size={16} />
              </span>
            )}
          </button>
          {submitError && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#fdecec", border: "1px solid #f5c2c2", color: "#8a2020", borderRadius: 10, fontSize: 13.5 }}>
              {submitError}
            </div>
          )}
          <div className="form-foot" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span><b style={{ color: "var(--navy-ink)" }}>Secure payment via Stripe.</b></span>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--muted)" }}>
              <Icon name="shield" size={14} /> 100% Secure. No obligation. Your data is strictly protected.
            </span>
          </div>
        </>
      )}
    </form>
  );
}

/* ---------- APP PROMO ---------- */
function AppPromo() {
  const [installPrompt, setInstallPrompt] = React.useState(null);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Check if the user is on an iOS device
    const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(checkIOS);
    
    // Check if mobile device
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
    setIsMobile(checkMobile);

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Also add listener for resize to update isMobile
    const handleResize = () => {
      const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
      setIsMobile(isMob);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <section className="app-promo-section" style={{ background: 'var(--navy-ink)', color: '#fff', padding: '80px 20px', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .app-promo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 60px;
        }
        @media (min-width: 768px) {
          .app-promo-wrap {
            flex-direction: row;
          }
        }
      `}</style>
      <div className="wrap app-promo-wrap" style={{ position: 'relative', zIndex: 2 }}>
        
        <div style={{ flex: 1, maxWidth: '500px' }}>
          <span className="section-kicker" style={{ color: 'var(--amber)' }}>Go Mobile</span>
          <h2 className="h2" style={{ color: '#fff', margin: '0 0 20px 0' }}>Keep track with our <em>booking portal.</em></h2>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.8)', marginBottom: '30px', lineHeight: 1.5 }}>
            Once you've booked, you can add our booking portal to your phone's home screen. Get instant status updates when your driver is en route, manage your bookings, and communicate directly. No App Store required.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(230,178,75,0.1)', padding: '6px', borderRadius: '50%' }}><Icon name="check" size={16} color="var(--amber)" /></div>
              <span>Get instant "En Route" & "Arrived" notifications</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(230,178,75,0.1)', padding: '6px', borderRadius: '50%' }}><Icon name="check" size={16} color="var(--amber)" /></div>
              <span>Manage your current and future bookings</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(230,178,75,0.1)', padding: '6px', borderRadius: '50%' }}><Icon name="check" size={16} color="var(--amber)" /></div>
              <span>Message your driver directly with one tap</span>
            </li>
          </ul>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {!isMobile ? (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Access on your phone:</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>
                  Once you book, you'll receive a link via SMS. Open it on your phone to add the booking portal to your home screen and keep a tab on your driver.
                </div>
              </>
            ) : installPrompt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ fontWeight: 'bold' }}>Install for Booking Updates</div>
                <button 
                  onClick={handleInstallClick}
                  style={{ background: 'var(--amber)', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  Add to Home Screen
                </button>
              </div>
            ) : isIOS ? (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>How to install on iPhone:</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>
                  Apple blocks automatic install buttons. To install, tap the <strong>Share</strong> icon at the bottom of Safari, then select <strong>"Add to Home Screen"</strong>.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>How to install:</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>
                  Open this website on Safari (iPhone) or Chrome (Android), tap the Share icon, and select <strong>"Add to Home Screen"</strong>.
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', perspective: '1000px' }}>
          {/* Decorative glow */}
          <div className="glow-pulse" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '500px', background: 'var(--amber)', filter: 'blur(100px)', opacity: 0.15, borderRadius: '50%' }}></div>
          
          {/* CSS iPhone Mockup */}
          <div className="iphone-mockup" style={{
            width: '320px',
            height: '650px',
            background: '#091321',
            borderRadius: '44px',
            border: '12px solid #111',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.6), inset 0 0 0 2px #333, inset 0 0 20px rgba(0,0,0,0.8)',
            position: 'relative',
            overflow: 'hidden',
            zIndex: 10,
            transform: 'rotateY(-10deg) rotateX(5deg)',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <style>{`
              .iphone-mockup:hover {
                transform: rotateY(0deg) rotateX(0deg) translateY(-10px);
              }
              .iphone-mockup::before {
                content: '';
                position: absolute;
                top: 0; left: -100%; width: 50%; height: 100%;
                background: linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent);
                transform: skewX(-20deg);
                animation: shimmer 6s infinite;
                z-index: 30;
                pointer-events: none;
              }
              @keyframes shimmer {
                0% { left: -100%; }
                20% { left: 200%; }
                100% { left: 200%; }
              }
              .app-screen {
                height: 100%;
                display: flex;
                flex-direction: column;
                background-image: radial-gradient(circle at 15% 0%, rgba(230, 178, 75, 0.15), transparent 40%), radial-gradient(circle at 85% 100%, rgba(14, 39, 71, 0.8), transparent 50%);
              }
            `}</style>

            {/* Dynamic Island */}
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '110px',
              height: '32px',
              background: '#000',
              borderRadius: '20px',
              zIndex: 20,
              boxShadow: 'inset 0 0 4px rgba(255,255,255,0.1)'
            }}>
              {/* Camera dot */}
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '10px', height: '10px', background: '#0a0a0a', borderRadius: '50%', border: '1px solid #1a1a1a', boxShadow: 'inset 0 0 2px rgba(255,255,255,0.2)' }}></div>
            </div>

            {/* Screen Content */}
            <div className="app-screen" style={{ padding: '60px 20px 30px', position: 'relative', zIndex: 10 }}>
              
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                  <LogoMark size={32} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'Lexend, sans-serif' }}>Your Booking</h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Ref: ATL-7K9M2P</div>
              </div>

              {/* Status Pill */}
              <div style={{
                background: 'rgba(230, 178, 75, 0.1)',
                color: 'var(--amber)',
                border: '1px solid rgba(230, 178, 75, 0.2)',
                borderRadius: '99px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '24px',
                boxShadow: '0 0 20px rgba(230, 178, 75, 0.1)'
              }}>
                <div style={{ position: 'relative', width: '10px', height: '10px' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--amber)', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', top: '-4px', left: '-4px', right: '-4px', bottom: '-4px', border: '2px solid var(--amber)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                </div>
                Driver En Route
              </div>

              {/* Details Cards */}
              <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Pickup • 14:30</div>
                  <div style={{ fontSize: '15px', color: '#fff', fontWeight: 500 }}>14 Wellington Rd, CH60</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Dropoff</div>
                  <div style={{ fontSize: '15px', color: '#fff', fontWeight: 500 }}>Liverpool John Lennon</div>
                </div>
              </div>

              {/* Driver Card */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(230, 178, 75, 0.15), rgba(230, 178, 75, 0.02))',
                padding: '20px',
                borderRadius: '20px',
                border: '1px solid rgba(230, 178, 75, 0.3)',
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 10px 30px -10px rgba(230, 178, 75, 0.15)'
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)', fontSize: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                  👨‍✈️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>Roy</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Silver Mercedes Vito</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Icon name="phone" size={16} />
                </div>
              </div>

            </div>

            {/* Home Indicator */}
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '120px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', zIndex: 20 }}></div>
          </div>
        </div>

      </div>
    </section>
  );
}

/* ---------- BOOK SECTION ---------- */
function BookSection() {
  return (
    <section id="book" className="book-section">
      <div className="wrap book-centered" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="book-lead" style={{ textAlign: 'center', maxWidth: '640px', marginBottom: '48px' }}>
          <span className="section-kicker" style={{ color: "var(--amber)", justifyContent: 'center' }}>Quick quote</span>
          <h2 className="h2"><em>Let's get you booked.</em></h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px' }}>Get your fixed price instantly — book and pay securely online in under 60 seconds.</p>
        </div>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <BookingForm />
        </div>
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
        <b>LJLA from £55 · MAN from £75</b>
        <span>Both legs · fixed price</span>
      </div>
      <a href="#book" className="btn btn-primary">Quick Quote</a>
    </div>
  );
}

/* ---------- FOOTER ---------- */
function Footer() {
  return (
    <footer style={{ background: "#050B14", color: "rgba(255, 255, 255, 0.7)", padding: "80px 0 40px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="wrap foot-centered" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
        <div className="brand" style={{ display: "flex", justifyContent: "center" }}>
          <img src="./assets/logo.png" alt="RM Transfers" style={{ height: "64px", width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>
        <div className="foot-copy" style={{ fontSize: "15px", maxWidth: "500px", margin: "0 auto", lineHeight: "1.6" }}>
          Fixed-price airport transfers. Door to terminal, both ways.<br />
          Licensed private hire · Est. 2011<br /><br />
          42 Jamaica Street, Liverpool, L1 0AF
        </div>
        <div className="foot-links" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "24px", marginTop: "16px" }}>
          <a href="/#how" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>How it works</a>
          <a href="/#faq" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>FAQ</a>
          <a href="/#reviews" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>Reviews</a>
          <a href="/about-us.html" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>About Us</a>
          <a href="/contact.html" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>Contact Us</a>
          <a href="/terms.html" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>Terms & Conditions</a>
          <a href="/privacy.html" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>Privacy Policy</a>
          <a href="/become-a-driver.html" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>Become a Driver</a>
        </div>
        <div style={{ marginTop: "32px", fontSize: "13px", color: "rgba(255, 255, 255, 0.4)", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "32px", width: "100%" }}>
          &copy; {new Date().getFullYear()} RM Transfers. All rights reserved.
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
    <AuroraBackground showRadialGradient={false}>
      <Nav />
      <Hero headline={t.headline} />

      <HowItWorks />
      <FixedPricePromise />
      <YourVehicle />
      <AppPromo />
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
    </AuroraBackground>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
