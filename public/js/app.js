/**
 * ==========================================================================
 * Application Utilities & Shared Helpers
 * ==========================================================================
 */

/**
 * Currency used for prices and checkout.
 * The currency selector was removed, so this is fixed to euros. Browser
 * storage is no longer read, so an old "usd" value from an earlier visit
 * cannot switch the page to dollars.
 * @returns {string}
 */
function getCurrency() {
  return 'eur';
}

/**
 * Format numerical amount to currency string.
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a date string. Plain "YYYY-MM-DD" values are read as calendar dates,
 * not as UTC midnight, so visitors west of UTC do not see the previous day.
 * @param {string|Date} value
 * @returns {Date}
 */
function parseCourseDate(value) {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}

/**
 * Format start and end dates into a readable date range string.
 * @param {string|Date} start
 * @param {string|Date} end
 * @returns {string}
 */
function formatDateRange(start, end) {
  const startDate = parseCourseDate(start);
  const endDate = parseCourseDate(end);

  if (isNaN(startDate) || isNaN(endDate)) return '';

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = startDate.toLocaleDateString('en-GB', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-GB', { month: 'short' });
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (
   startYear === endYear &&
   startMonth === endMonth &&
   startDay === endDay
  ) {
   return `${startDay} ${startMonth} ${startYear}`;
  } else if (startYear === endYear && startMonth === endMonth) {
   return `${startDay}–${endDay} ${startMonth} ${startYear}`;
  } else if (startYear === endYear) {
   return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  } else {
   return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
}

/**
 * Format the daily course times, e.g. "09:00–13:00 CET (Berlin time)".
 * Times are entered in Berlin time. The label switches between CET and
 * CEST depending on the course date.
 * @param {string} date - course start date, "YYYY-MM-DD"
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime - "HH:MM"
 * @returns {string}
 */
function formatTimeRange(date, startTime, endTime) {
  if (!startTime || !endTime) return '';

  let zone = 'CET';
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    // Midday UTC on the course date avoids edge cases around the switch.
    const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
    const offset = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(probe)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (offset === 'GMT+2') zone = 'CEST';
  }

  return `${startTime}–${endTime} ${zone} (Berlin time)`;
}

/**
 * Text shown after the price, depending on the Stripe price's tax behaviour.
 * @param {string} taxBehavior - "inclusive", "exclusive" or "unspecified"
 * @returns {string}
 */
function vatLabel(taxBehavior) {
  if (taxBehavior === 'inclusive') return 'incl. VAT';
  if (taxBehavior === 'exclusive') return 'plus VAT';
  return '';
}

/**
 * Escape HTML special characters for safe rendering in templates.
 * @param {any} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * ==========================================================================
 * Interactive Components
 * ==========================================================================
 */

/**
 * Initialize accordion components with accessible toggle logic.
 */
function initAccordions() {
  document.querySelectorAll('.acc, .accordion-button').forEach((button) => {
    button.addEventListener('click', () => {
      const isActive = button.classList.toggle('active');
      const panel = button.nextElementSibling;

      if (panel) {
        panel.style.display = isActive ? 'block' : 'none';
        button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      }
    });
  });
}

/**
 * Initialize course index listing on the homepage.
 */
async function initCourseIndex() {
  const courseList = document.getElementById('course-list');
  if (!courseList) return;

  try {
    const res = await fetch('/api/courses');

    if (!res.ok) {
      throw new Error(`Could not load courses: ${res.status}`);
    }

    const cohorts = await res.json();
    const courses = new Map();

    cohorts.forEach((cohort) => {
      if (!courses.has(cohort.course_slug)) {
        courses.set(cohort.course_slug, {
          course_slug: cohort.course_slug,
          course_name: cohort.course_name,
          description: cohort.description,
          highlights: cohort.highlights || [],
          flagship: cohort.flagship === true,
          cohorts: [],
        });
      }
      courses.get(cohort.course_slug).cohorts.push(cohort);
    });

    if (courses.size === 0) {
      courseList.innerHTML = `<p class="muted">No upcoming courses at the moment.</p>`;
      return;
    }

    const sortedCourses = Array.from(courses.values())
      .map((course) => {
        course.cohorts.sort(
          (a, b) => parseCourseDate(a.start_date) - parseCourseDate(b.start_date)
        );
        return course;
      })
      .sort(
        (a, b) =>
          parseCourseDate(a.cohorts[0].start_date) -
          parseCourseDate(b.cohorts[0].start_date)
      );

    courseList.innerHTML = sortedCourses
      .map((course) => {
        const nextCohort = course.cohorts[0];
        const nextTimes = formatTimeRange(
          nextCohort.start_date,
          nextCohort.start_time,
          nextCohort.end_time
        );

        const highlightsHtml = course.highlights.length
          ? `
            <ul>
              ${course.highlights
                .map((h) => `<li>${escapeHtml(h)}</li>`)
                .join('')}
            </ul>
          `
          : '';

        return `
          <article class="course-card${course.flagship ? ' flagship' : ''}">
            <h3>${escapeHtml(course.course_name)}</h3>

            <p>${escapeHtml(course.description)}</p>

            ${highlightsHtml}

            <p class="course-next-cohort">
              <strong>Next cohort:</strong><br>
              ${formatDateRange(nextCohort.start_date, nextCohort.end_date)}
              ${nextTimes ? `<br><span class="muted">${escapeHtml(nextTimes)}</span>` : ''}
            </p>

            <a class="btn" href="/${encodeURIComponent(course.course_slug)}">
              View course
            </a>
          </article>
        `;
      })
      .join('');
  } catch (e) {
    console.error('Failed to load courses:', e);
    courseList.innerHTML = `
      <p class="notice error">
        Couldn't load upcoming courses — please refresh.
      </p>
    `;
  }
}

/**
 * Global App Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initCourseIndex();
});
