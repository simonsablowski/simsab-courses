/**
 * ==========================================================================
 * Course Enrollment Widget Component
 * ==========================================================================
 */

async function initEnrollWidget() {
  const widget = document.getElementById('enroll');
  if (!widget) return;

  const slug =
    widget.dataset.courseSlug || new URLSearchParams(window.location.search).get('course');

  const cohortList = document.getElementById('cohort-list');
  const priceDisplay = document.getElementById('price-display');
  const enrollBtn = document.getElementById('enroll-btn');
  const checkoutError = document.getElementById('checkout-error');

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
      </div>`;
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

    priceDisplay.textContent = formatMoney(base, currency);
  }

  if (enrollBtn) {
    enrollBtn.addEventListener('click', async () => {
      if (checkoutError) checkoutError.textContent = '';

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

        if (!res.ok) throw new Error(data.error || 'Something went wrong');

        window.location.href = data.url;
      } catch (e) {
        console.error('Checkout error:', e);

        enrollBtn.disabled = false;
        enrollBtn.textContent = 'Enrol now';
      }
    });
  }

  drawCohorts();
  updatePriceDisplay();
}

document.addEventListener('DOMContentLoaded', initEnrollWidget);
