async function initCoursePage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("course");
  const cohortList = document.getElementById("cohort-list");
  const enrollBtn = document.getElementById("enroll-btn");
  const priceHint = document.getElementById("price-hint");
  const errorBox = document.getElementById("checkout-error");

  let cohorts = [];
  let selectedCohortId = null;

  try {
    const res = await fetch("/api/courses");
    const all = await res.json();
    cohorts = all.filter((c) => c.course_slug === slug);
  } catch (e) {
    cohortList.innerHTML = `<p class="notice error">Couldn't load cohort dates — please refresh.</p>`;
    return;
  }

  if (cohorts.length === 0) {
    cohortList.innerHTML = `<p class="muted">No open cohorts for this course right now.</p>`;
    enrollBtn.disabled = true;
    return;
  }

  document.title = `${cohorts[0].course_name} — Simon Sablowski`;
  document.getElementById("course-title").textContent = cohorts[0].course_name;
  document.getElementById("course-description").textContent = cohorts[0].description;
  const highlightsEl = document.getElementById("course-highlights");
  highlightsEl.innerHTML = cohorts[0].highlights.map((h) => `<li>${h}</li>`).join("");

  function drawCohorts(currency) {
    cohortList.innerHTML = cohorts
      .map(
        (c, i) => `
      <label class="cohort-option">
        <input type="radio" name="cohort" value="${c.cohort_id}" ${i === 0 ? "checked" : ""} ${c.seats_left === 0 ? "disabled" : ""}>
        <span class="cohort-dates">${formatDateRange(c.start_date, c.end_date)}</span>
        <span class="cohort-seats">${c.seats_left === 0 ? "Full" : `${c.seats_left} seat${c.seats_left === 1 ? "" : "s"} left`}</span>
      </label>`
      )
      .join("");

    selectedCohortId = cohorts.find((c) => c.seats_left > 0)?.cohort_id || cohorts[0].cohort_id;
    updatePriceHint(currency);

    cohortList.querySelectorAll('input[name="cohort"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        selectedCohortId = e.target.value;
        updatePriceHint(getCurrency());
      });
    });
  }

  function updatePriceHint(currency) {
    const c = cohorts.find((x) => x.cohort_id === selectedCohortId);
    if (!c) return;
    priceHint.textContent = `${formatMoney(currency === "eur" ? c.price_eur : c.price_usd, currency)} per seat`;
  }

  wireCurrencyToggle((currency) => {
    updatePriceHint(currency);
  });
  drawCohorts(getCurrency());

  enrollBtn.addEventListener("click", async () => {
    errorBox.textContent = "";
    enrollBtn.disabled = true;
    enrollBtn.textContent = "Redirecting to checkout…";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_slug: slug,
          cohort_id: selectedCohortId,
          currency: getCurrency(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      window.location.href = data.url;
    } catch (e) {
      errorBox.textContent = e.message;
      enrollBtn.disabled = false;
      enrollBtn.textContent = "Enroll — pay by card or PayPal";
    }
  });
}

document.addEventListener("DOMContentLoaded", initCoursePage);
