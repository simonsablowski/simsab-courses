/**
 * ==========================================================================
 * Course Enrollment Widget Component
 * ==========================================================================
 */

const CONTACT_EMAIL = 'contact@simsab.net';

// German VAT rate, used to show the gross price next to net prices.
const GERMAN_VAT_RATE = 0.19;

// Set to '/terms' once the terms and conditions page is published.
const TERMS_URL = '';

async function initEnrollWidget() {
  const widget = document.getElementById('enroll');
  if (!widget) return;

  const slug =
    widget.dataset.courseSlug || new URLSearchParams(window.location.search).get('course');

  const cohortList = document.getElementById('cohort-list');
  const priceDisplay = document.getElementById('price-display');
  const enrollBtn = document.getElementById('enroll-btn');

  /**
   * Error message and booking notes below the "Enrol now" button.
   * Added here so the markup lives in one place instead of in every course page.
   */
  const checkoutError = document.createElement('p');
  checkoutError.id = 'checkout-error';
  checkoutError.className = 'notice error';
  checkoutError.setAttribute('role', 'alert');
  checkoutError.hidden = true;

  const enrolNotes = document.createElement('div');
  enrolNotes.className = 'enrol-notes';
  enrolNotes.innerHTML = `
    <p>
      Booking for several people? Email
      <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
      and we will send you an offer and a single invoice.
    </p>
    ${
      TERMS_URL
        ? `<p>By enrolling, you accept our <a href="${TERMS_URL}">terms and conditions</a>.</p>`
        : ''
    }`;

  if (enrollBtn) {
    enrollBtn.after(checkoutError, enrolNotes);
  }

  function showError(message) {
    checkoutError.textContent = message;
    checkoutError.hidden = !message;
  }

  /**
   * Mobile enrollment bar
   */
  const mobileToggle = document.createElement('button');
  mobileToggle.type = 'button';
  mobileToggle.className = 'mobile-enroll-toggle';
  mobileToggle.setAttribute('aria-expanded', 'false');
  mobileToggle.textContent = 'Enrol in this course';

  widget.prepend(mobileToggle);

  mobileToggle.addEventListener('click', () => {
    const expanded = widget.classList.toggle('mobile-expanded');

    mobileToggle.setAttribute('aria-expanded', String(expanded));
    mobileToggle.textContent = expanded
      ? 'Close enrolment options'
      : 'Enrol in this course';
  });

  let cohorts = [];
  let selectedCohortId = null;

  try {
    const res = await fetch('/api/courses');
    const all = await res.json();
    cohorts = all.filter((c) => c.course_slug === slug);
  } catch (e) {
    if (cohortList) {
      cohortList.innerHTML = `<p class="notice error">Couldn't load cohort dates — please refresh.</p>`;
    }
    if (enrollBtn) {
      enrollBtn.disabled = true;
    }
    return;
  }

  if (cohorts.length === 0) {
    if (cohortList) {
      cohortList.innerHTML = `<p class="lead m-0">No open cohorts right now — check back soon.</p>`;
    }
    if (enrollBtn) {
      enrollBtn.disabled = true;
    }
    return;
  }

  function drawCohorts() {
    if (!cohortList) return;

    const c = cohorts.find((item) => item.seats_left > 0) || cohorts[0];
    selectedCohortId = c.cohort_id;

    const times = formatTimeRange(c.start_date, c.start_time, c.end_time);
    const multiDay = c.end_date && c.end_date !== c.start_date;

    cohortList.innerHTML = `
      <div class="cohort-option">
        <div class="cohort-content">
          <div class="cohort-dates">
            ${formatDateRange(c.start_date, c.end_date)}
          </div>

          <div class="cohort-seats">
            ${c.seats_left === 0 ? 'Full' : `${c.seats_left} seats left`}
          </div>
        </div>
      </div>
      ${times ? `<p class="cohort-time">${multiDay ? 'Each day ' : ''}${escapeHtml(times)}</p>` : ''}`;

    if (enrollBtn && c.seats_left === 0) {
      enrollBtn.disabled = true;
      enrollBtn.textContent = 'Fully booked';
    }
  }

  function currentCohort() {
    return cohorts.find((c) => c.cohort_id === selectedCohortId);
  }

  function updatePriceDisplay() {
    if (!priceDisplay) return;

    const c = currentCohort();
    if (!c) return;
    const currency = getCurrency();
    const base = currency === 'eur' ? c.price_eur : c.price_usd;
    const taxBehavior = currency === 'eur' ? c.tax_behavior_eur : c.tax_behavior_usd;

    // Net prices: show the gross price for German customers first, as
    // required for consumers, and the net price below for business buyers.
    // Stripe calculates the exact VAT for other countries at checkout.
    if (taxBehavior === 'exclusive') {
      const gross = Math.round(base * (1 + GERMAN_VAT_RATE) * 100) / 100;
      priceDisplay.innerHTML = `
        ${escapeHtml(formatMoney(gross, currency))}
        <span class="cohort-price-note">incl. VAT</span>
        <div class="cohort-price-net">${escapeHtml(formatMoney(base, currency))} excl. VAT</div>`;
      return;
    }

    const label = vatLabel(taxBehavior);
    priceDisplay.innerHTML = `${escapeHtml(formatMoney(base, currency))}${
      label ? ` <span class="cohort-price-note">${escapeHtml(label)}</span>` : ''
    }`;
  }

  if (enrollBtn) {
    enrollBtn.addEventListener('click', async () => {
      showError('');

      enrollBtn.disabled = true;
      enrollBtn.textContent = 'Redirecting…';

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_slug: slug,
            cohort_id: selectedCohortId,
            currency: getCurrency(),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const err = new Error(data.error || 'Something went wrong');
          // 404 and 409 carry messages written for visitors, such as
          // "This cohort is full". Other errors are technical.
          err.userMessage = [404, 409].includes(res.status) ? data.error : '';
          throw err;
        }

        window.location.href = data.url;
      } catch (e) {
        console.error('Checkout error:', e);
        showError(
          e.userMessage
            ? `${e.userMessage}. Please email ${CONTACT_EMAIL} if you have questions.`
            : `Enrolment could not be started. Please try again, or email ${CONTACT_EMAIL}.`
        );

        enrollBtn.disabled = false;
        enrollBtn.textContent = 'Enrol now';
      }
    });
  }

  drawCohorts();
  updatePriceDisplay();
}

document.addEventListener('DOMContentLoaded', initEnrollWidget);
