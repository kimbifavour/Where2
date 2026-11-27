const messageEl = document.querySelector('#message');
const statsEl = document.querySelector('#admin-stats');
const usersBody = document.querySelector('#users-body');
const reportsBody = document.querySelector('#reports-body');
const resourcesBody = document.querySelector('#resources-body');

function setMessage(text, tone = 'info') {
  messageEl.textContent = text;
  messageEl.className = `message ${tone}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="muted">${escapeHtml(text)}</td></tr>`;
}

function renderStats(stats) {
  const tiles = [
    ['Users', stats.total_users],
    ['Admins', stats.total_admins],
    ['Reports', stats.total_reports],
    ['Hidden reports', stats.hidden_reports],
    ['Resources', stats.total_resources],
    ['Inactive resources', stats.inactive_resources],
  ];
  statsEl.innerHTML = tiles.map(([label, value]) => `
    <div class="admin-stat"><span class="admin-stat-value">${value}</span><span class="admin-stat-label">${label}</span></div>
  `).join('');
}

function renderUsers(users, currentUserId) {
  if (!users.length) {
    usersBody.innerHTML = emptyRow(6, 'No users yet.');
    return;
  }
  usersBody.innerHTML = users.map((u) => {
    const isSelf = Number(u.id) === Number(currentUserId);
    const isAdmin = u.role === 'admin';
    const action = isSelf
      ? '<span class="muted small">You</span>'
      : `<button type="button" class="admin-button ${isAdmin ? 'danger' : ''}"
           data-action="role" data-id="${u.id}" data-role="${isAdmin ? 'user' : 'admin'}">
           ${isAdmin ? 'Remove admin' : 'Make admin'}
         </button>`;
    return `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="pill ${isAdmin ? 'pill-admin' : ''}">${isAdmin ? 'Admin' : 'User'}</span></td>
        <td>${u.report_count}</td>
        <td>${escapeHtml(formatDate(u.created_at))}</td>
        <td class="admin-actions">${action}</td>
      </tr>`;
  }).join('');
}

function renderReports(reports) {
  if (!reports.length) {
    reportsBody.innerHTML = emptyRow(7, 'No reports yet.');
    return;
  }
  reportsBody.innerHTML = reports.map((rp) => `
    <tr class="${rp.is_hidden ? 'is-muted' : ''}">
      <td><strong>${escapeHtml(rp.resource_name)}</strong><br><span class="muted small">${escapeHtml(rp.building)}</span></td>
      <td>${escapeHtml(rp.condition_name)}</td>
      <td class="admin-comment">${escapeHtml(rp.comment || '—')}</td>
      <td>${escapeHtml(rp.reporter_name)}<br><span class="muted small">${escapeHtml(formatDate(rp.created_at))}</span></td>
      <td><span class="small">${rp.confirm_count} confirm · ${rp.dispute_count} dispute</span></td>
      <td>
        <span class="pill ${rp.is_hidden ? 'pill-off' : 'pill-on'}">${rp.is_hidden ? 'Hidden' : 'Visible'}</span>
        ${rp.moderator_name ? `<br><span class="muted small">by ${escapeHtml(rp.moderator_name)}</span>` : ''}
      </td>
      <td class="admin-actions">
        <button type="button" class="admin-button ${rp.is_hidden ? '' : 'danger'}"
          data-action="report" data-id="${rp.id}" data-hidden="${!rp.is_hidden}">
          ${rp.is_hidden ? 'Restore' : 'Hide'}
        </button>
      </td>
    </tr>`).join('');
}

const resourceForm = document.querySelector('#resource-form');
const resourceFormTitle = document.querySelector('#resource-form-title');
const resourceSubmit = document.querySelector('#resource-submit');
const resourceCancel = document.querySelector('#resource-cancel');
let resourcesById = new Map();

function renderCategoryOptions(categories) {
  const select = resourceForm.elements.category_id;
  const current = select.value;
  select.innerHTML = '<option value="">Choose…</option>' + categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  select.value = current;
}

function resetResourceForm() {
  resourceForm.reset();
  resourceForm.elements.id.value = '';
  resourceFormTitle.textContent = 'Add a resource';
  resourceSubmit.textContent = 'Add resource';
  resourceCancel.hidden = true;
}

function startEditingResource(id) {
  const r = resourcesById.get(Number(id));
  if (!r) return;
  const f = resourceForm.elements;
  f.id.value = r.id;
  f.name.value = r.name ?? '';
  f.category_id.value = r.category_id;
  f.building.value = r.building ?? '';
  f.floor.value = r.floor ?? '';
  f.capacity.value = r.capacity ?? '';
  f.features.value = r.features ?? '';
  f.description.value = r.description ?? '';
  resourceFormTitle.textContent = `Edit ${r.name}`;
  resourceSubmit.textContent = 'Save changes';
  resourceCancel.hidden = false;
  resourceForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.name.focus();
}

resourceCancel.addEventListener('click', resetResourceForm);

resourceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(resourceForm));
  const id = payload.id;
  delete payload.id;

  resourceSubmit.disabled = true;
  try {
    const response = await fetch(id ? `/api/admin/resources/${id}` : '/api/admin/resources', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save the resource.');
    setMessage(data.message, 'success');
    resetResourceForm();
    await loadOverview();
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    resourceSubmit.disabled = false;
  }
});

function renderResources(resources) {
  resourcesById = new Map(resources.map((r) => [Number(r.id), r]));
  if (!resources.length) {
    resourcesBody.innerHTML = emptyRow(5, 'No resources yet.');
    return;
  }
  resourcesBody.innerHTML = resources.map((r) => `
    <tr class="${r.is_active ? '' : 'is-muted'}">
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td>${escapeHtml(r.category_name)}</td>
      <td>${escapeHtml(r.building)}${r.floor ? ` · ${escapeHtml(r.floor)}` : ''}</td>
      <td><span class="pill ${r.is_active ? 'pill-on' : 'pill-off'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
      <td class="admin-actions">
        <button type="button" class="admin-button" data-edit-resource="${r.id}">Edit</button>
        <button type="button" class="admin-button ${r.is_active ? 'danger' : ''}"
          data-action="resource" data-id="${r.id}" data-active="${!r.is_active}">
          ${r.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>`).join('');
}

async function loadOverview() {
  try {
    const response = await fetch('/api/admin/overview', { headers: { Accept: 'application/json' } });
    if (response.status === 401 || response.status === 403) {
      window.location.href = response.status === 401 ? '/login' : '/dashboard';
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load admin data.');

    renderStats(data.stats);
    renderUsers(data.users, data.currentUserId);
    renderReports(data.reports);
    renderCategoryOptions(data.categories || []);
    renderResources(data.resources);
  } catch (error) {
    setMessage(error.message, 'error');
  }
}

function requestFor(button) {
  const { action, id } = button.dataset;
  if (action === 'role') {
    return { url: `/api/admin/users/${id}/role`, body: { role: button.dataset.role } };
  }
  if (action === 'report') {
    return { url: `/api/admin/reports/${id}/visibility`, body: { hidden: button.dataset.hidden === 'true' } };
  }
  if (action === 'resource') {
    return { url: `/api/admin/resources/${id}/active`, body: { active: button.dataset.active === 'true' } };
  }
  return null;
}

document.querySelector('#main').addEventListener('click', async (event) => {
  const editButton = event.target.closest('button[data-edit-resource]');
  if (editButton) {
    startEditingResource(editButton.dataset.editResource);
    return;
  }

  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const request = requestFor(button);
  if (!request) return;

  if (button.dataset.action === 'role' && button.dataset.role === 'admin'
      && !window.confirm('Give this user full admin access?')) {
    return;
  }

  button.disabled = true;
  try {
    const response = await fetch(request.url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request.body),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Action failed.');
    setMessage(data.message, 'success');
    await loadOverview();
  } catch (error) {
    setMessage(error.message, 'error');
    button.disabled = false;
  }
});

loadOverview();
