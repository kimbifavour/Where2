const REFRESH_MS = 30000;

const els = {
  message: document.querySelector('#dashMessage'),
  updated: document.querySelector('#updated'),
  windowLabel: document.querySelector('#windowLabel'),
  statResources: document.querySelector('#statResources'),
  statReports: document.querySelector('#statReports'),
  statObserved: document.querySelector('#statObserved'),
  statObservedSub: document.querySelector('#statObservedSub'),
  chart: document.querySelector('#chart'),
  chartTable: document.querySelector('#chartTable'),
  toggleTable: document.querySelector('#toggleTable'),
  tooltip: document.querySelector('#tooltip'),
  chartPanel: document.querySelector('.chart-panel'),
  favList: document.querySelector('#favList'),
  favCount: document.querySelector('#favCount'),
  unfList: document.querySelector('#unfList'),
  unfCount: document.querySelector('#unfCount'),
  recentList: document.querySelector('#recentList'),
  form: document.querySelector('#reportForm'),
  resourceSelect: document.querySelector('#resourceSelect'),
  conditionSelect: document.querySelector('#conditionSelect'),
  conditionLabel: document.querySelector('#conditionLabel'),
  commentInput: document.querySelector('#commentInput'),
  submitButton: document.querySelector('#submitReport'),
  formMessage: document.querySelector('#formMessage'),
};

const STATUSES = [
  { key: 'favorable', cls: 'fav', label: 'Favorable' },
  { key: 'moderate', cls: 'mod', label: 'Moderate' },
  { key: 'unfavorable', cls: 'unf', label: 'Unfavorable' },
  { key: 'unknown', cls: 'unk', label: 'No recent reports' },
];

let reportOptions = { resources: [], conditions: [] };
let lastSeenReportIds = new Set();
let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatAge(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min ago`;
}

function setMessage(el, text, tone = 'info') {
  el.textContent = text;
  el.classList.toggle('error', tone === 'error');
}

/* ---------- Summary tiles ---------- */

function setStat(el, value) {
  const next = String(value);
  if (el.textContent !== next && el.textContent !== '–') {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 1200);
  }
  el.textContent = next;
}

/* ---------- Chart: stacked bar per category ---------- */

function renderChart(categories) {
  if (!categories.length) {
    els.chart.innerHTML = '<p class="muted">No resources to chart yet.</p>';
    els.chart.setAttribute('aria-label', 'No data');
    return;
  }

  const summary = categories.map((c) =>
    `${c.category}: ${STATUSES.map((s) => `${c[s.key]} ${s.label.toLowerCase()}`).join(', ')}`
  ).join('. ');
  els.chart.setAttribute('aria-label', `Resource status by category. ${summary}.`);

  els.chart.innerHTML = categories.map((c) => {
    const total = STATUSES.reduce((sum, s) => sum + c[s.key], 0);
    const segments = STATUSES.filter((s) => c[s.key] > 0).map((s) => `
      <button type="button" class="seg ${s.cls}" style="flex-grow:${c[s.key]}"
        data-tip="${escapeHtml(`${c.category} · ${s.label}: ${c[s.key]} of ${total}`)}"
        aria-label="${escapeHtml(`${c.category}, ${s.label}: ${c[s.key]} of ${total}`)}">
        <span aria-hidden="true">${c[s.key]}</span>
      </button>`).join('');
    return `
      <div class="bar-row">
        <span class="bar-name">${escapeHtml(c.category)}</span>
        <div class="bar-track">${segments}</div>
        <span class="bar-total" title="Total resources">${total}</span>
      </div>`;
  }).join('');

  els.chartTable.innerHTML = `
    <table>
      <thead><tr><th scope="col">Category</th>${STATUSES.map((s) => `<th scope="col">${s.label}</th>`).join('')}</tr></thead>
      <tbody>
        ${categories.map((c) => `<tr><th scope="row">${escapeHtml(c.category)}</th>${STATUSES.map((s) => `<td>${c[s.key]}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
}

function showTooltip(target) {
  const tip = target.dataset.tip;
  if (!tip) return;
  els.tooltip.textContent = tip;
  els.tooltip.hidden = false;
  const panelBox = els.chartPanel.getBoundingClientRect();
  const segBox = target.getBoundingClientRect();
  const tipBox = els.tooltip.getBoundingClientRect();
  let left = segBox.left - panelBox.left + segBox.width / 2 - tipBox.width / 2;
  left = Math.max(4, Math.min(left, panelBox.width - tipBox.width - 4));
  els.tooltip.style.left = `${left}px`;
  els.tooltip.style.top = `${segBox.top - panelBox.top - tipBox.height - 6}px`;
}

function hideTooltip() {
  els.tooltip.hidden = true;
}

els.chart.addEventListener('mouseover', (e) => {
  const seg = e.target.closest('.seg');
  if (seg) showTooltip(seg);
});
els.chart.addEventListener('mouseleave', hideTooltip);
els.chart.addEventListener('focusin', (e) => {
  const seg = e.target.closest('.seg');
  if (seg) showTooltip(seg);
});
els.chart.addEventListener('focusout', hideTooltip);

els.toggleTable.addEventListener('click', () => {
  const showing = !els.chartTable.hidden;
  els.chartTable.hidden = showing;
  els.chart.hidden = !showing;
  els.toggleTable.textContent = showing ? 'Show table' : 'Show chart';
  els.toggleTable.setAttribute('aria-pressed', String(!showing));
  hideTooltip();
});

/* ---------- Resource lists ---------- */

function renderList(listEl, items, emptyText, highlightIds) {
  if (!items.length) {
    listEl.innerHTML = `<li class="empty-item">${escapeHtml(emptyText)}</li>`;
    return;
  }
  listEl.innerHTML = items.map((r) => `
    <li class="${highlightIds.has(r.id) ? 'fresh' : ''}">
      <span class="res-name">${escapeHtml(r.name)}</span>
      <span class="res-meta">${escapeHtml(r.category_name)} · ${escapeHtml(r.building)}</span>
      <span class="res-meta">
        ${escapeHtml(r.latest_condition || 'Unknown')} · ${r.report_count} report${r.report_count === 1 ? '' : 's'} · ${escapeHtml(formatAge(r.last_report_at))}
      </span>
    </li>`).join('');
}

/* ---------- Whole dashboard ---------- */

function renderDashboard(data, { highlightResourceId = null } = {}) {
  const { counts } = data;
  setStat(els.statResources, counts.active_resources);
  setStat(els.statReports, counts.active_reports);
  setStat(els.statObserved, counts.observed_resources);
  els.statObservedSub.textContent = counts.active_resources
    ? `${Math.round((counts.observed_resources / counts.active_resources) * 100)}% of active resources`
    : '';

  const minutes = data.active_window_minutes;
  els.windowLabel.textContent = minutes % 60 === 0 ? `${minutes / 60} hours` : `${minutes} minutes`;

  // Highlight resources whose latest report time changed since the previous render.
  const recentKeys = new Set(data.recent.map((r) => `${r.id}@${r.last_report_at}`));
  const changed = new Set(
    data.recent
      .filter((r) => lastSeenReportIds.size && !lastSeenReportIds.has(`${r.id}@${r.last_report_at}`))
      .map((r) => r.id)
  );
  if (highlightResourceId) changed.add(highlightResourceId);
  lastSeenReportIds = recentKeys;

  renderChart(data.by_category);
  renderList(els.favList, data.favorable, 'No resources are currently favorable.', changed);
  renderList(els.unfList, data.unfavorable, 'No resources are currently unfavorable.', changed);
  renderList(els.recentList, data.recent.slice(0, 8), 'No observations in this window.', changed);
  els.favCount.textContent = `(${data.favorable.length})`;
  els.unfCount.textContent = `(${data.unfavorable.length})`;

  els.updated.textContent = `Updated ${new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard', { headers: { Accept: 'application/json' } });
    if (response.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load dashboard.');
    renderDashboard(data);
    setMessage(els.message, '');
  } catch (error) {
    console.error(error);
    setMessage(els.message, error.message, 'error');
  }
}

/* ---------- Report form ---------- */

function renderConditionOptions() {
  const resource = reportOptions.resources.find((r) => String(r.id) === els.resourceSelect.value);
  if (!resource) {
    els.conditionSelect.innerHTML = '<option value="">Choose a resource first</option>';
    els.conditionSelect.disabled = true;
    els.conditionLabel.textContent = 'Condition';
    return;
  }
  const options = reportOptions.conditions.filter((c) => c.category_id === resource.category_id);
  els.conditionLabel.textContent = resource.condition_label;
  els.conditionSelect.innerHTML = '<option value="">Select…</option>' +
    options.map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
  els.conditionSelect.disabled = false;
}

async function loadReportOptions() {
  try {
    const response = await fetch('/api/report-options', { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load the form.');
    reportOptions = data;

    const groups = new Map();
    data.resources.forEach((r) => {
      if (!groups.has(r.category_name)) groups.set(r.category_name, []);
      groups.get(r.category_name).push(r);
    });
    els.resourceSelect.innerHTML = '<option value="">Select a resource…</option>' +
      Array.from(groups, ([category, items]) => `
        <optgroup label="${escapeHtml(category)}">
          ${items.map((r) => `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.building)})</option>`).join('')}
        </optgroup>`).join('');
  } catch (error) {
    els.resourceSelect.innerHTML = '<option value="">Unavailable</option>';
    setMessage(els.formMessage, error.message, 'error');
  }
}

els.resourceSelect.addEventListener('change', renderConditionOptions);

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const resourceId = Number(els.resourceSelect.value);
  const conditionId = Number(els.conditionSelect.value);

  if (!resourceId) {
    setMessage(els.formMessage, 'Please choose a resource.', 'error');
    els.resourceSelect.focus();
    return;
  }
  if (!conditionId) {
    setMessage(els.formMessage, 'Please choose a condition.', 'error');
    els.conditionSelect.focus();
    return;
  }

  els.submitButton.disabled = true;
  setMessage(els.formMessage, 'Submitting…');

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        resource_id: resourceId,
        condition_id: conditionId,
        comment: els.commentInput.value.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save your report.');

    // The server returns the fresh summary, so the dashboard updates without a reload.
    renderDashboard(data.dashboard, { highlightResourceId: resourceId });
    setMessage(els.formMessage, data.message);
    els.form.reset();
    renderConditionOptions();
  } catch (error) {
    setMessage(els.formMessage, error.message, 'error');
  } finally {
    els.submitButton.disabled = false;
  }
});

/* ---------- Background refresh (picks up other users' reports) ---------- */

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(loadDashboard, REFRESH_MS);
}

function stopRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopRefresh();
  } else {
    loadDashboard();
    startRefresh();
  }
});

loadDashboard();
loadReportOptions();
startRefresh();
