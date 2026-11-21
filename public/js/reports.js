const listEl = document.querySelector('#report-list');
const messageEl = document.querySelector('#message');

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

function formatAge(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Unknown age';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function loadReports() {
  setMessage('Loading reports…');
  try {
    const response = await fetch('/api/reports', { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not load reports');

    if (!data.reports.length) {
      listEl.innerHTML = '<div class="empty">No recent observations are available.</div>';
      setMessage('');
      return;
    }

    listEl.innerHTML = data.reports.map((report) => `
      <article class="report-card" data-report-id="${report.id}">
        <div class="report-main">
          <p class="report-meta"><strong>${escapeHtml(report.resource_name)}</strong> · ${escapeHtml(report.category_name)} · ${escapeHtml(report.building)}</p>
          <p class="report-condition"><span>${escapeHtml(report.condition_name)}</span></p>
          <blockquote>${escapeHtml(report.comment || 'No comment provided.')}</blockquote>
          <p class="small muted">Submitted ${escapeHtml(formatAge(report.created_at))} by ${escapeHtml(report.reporter_name)}</p>
        </div>
        <div class="vote-panel">
          <div class="vote-counts" aria-label="Vote totals">
            <span><strong>${report.confirm_count}</strong> Confirm</span>
            <span><strong>${report.dispute_count}</strong> Dispute</span>
          </div>
          ${report.is_own_report
            ? '<p class="own-report">This is your report</p>'
            : `<div class="vote-actions" aria-label="Vote on report">
                <button type="button" class="vote-button ${report.current_user_vote === 'confirm' ? 'selected' : ''}" data-vote="confirm" aria-pressed="${report.current_user_vote === 'confirm'}">Confirm</button>
                <button type="button" class="vote-button dispute ${report.current_user_vote === 'dispute' ? 'selected' : ''}" data-vote="dispute" aria-pressed="${report.current_user_vote === 'dispute'}">Dispute</button>
              </div>`}
        </div>
      </article>
    `).join('');
    setMessage(`${data.reports.length} report${data.reports.length === 1 ? '' : 's'} loaded.`);
  } catch (error) {
    console.error(error);
    setMessage(error.message, 'error');
    listEl.innerHTML = '<div class="empty">Unable to load community reports.</div>';
  }
}

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-vote]');
  if (!button) return;

  const card = button.closest('[data-report-id]');
  const reportId = card.dataset.reportId;
  const vote = button.dataset.vote;
  button.disabled = true;

  try {
    const response = await fetch(`/api/reports/${reportId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ vote }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Could not save your vote');

    card.querySelector('.vote-counts').innerHTML = `
      <span><strong>${data.confirm_count}</strong> Confirm</span>
      <span><strong>${data.dispute_count}</strong> Dispute</span>
    `;
    card.querySelectorAll('[data-vote]').forEach((voteButton) => {
      const isSelected = voteButton.dataset.vote === data.current_user_vote;
      voteButton.classList.toggle('selected', isSelected);
      voteButton.setAttribute('aria-pressed', String(isSelected));
    });
    setMessage(data.message);
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

loadReports();
