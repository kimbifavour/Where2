const qInput = document.querySelector('#q');
const categorySelect = document.querySelector('#category');
const listEl = document.querySelector('#list');
const messageEl = document.querySelector('#message');
const countEl = document.querySelector('#count');

let allResources = [];

function setMessage(text, tone = 'info') {
  messageEl.textContent = text;
  messageEl.style.color = tone === 'error' ? '#b91c1c' : '#1f2937';
}

function renderCategoryOptions(categories) {
  const options = ['<option value="">All categories</option>'];
  categories.forEach((category) => {
    options.push(`<option value="${category.name}">${category.name}</option>`);
  });
  categorySelect.innerHTML = options.join('');
}

function getFilteredResources() {
  const search = (qInput.value || '').trim().toLowerCase();
  const category = categorySelect.value || '';

  return allResources.filter((resource) => {
    const resourceName = (resource.name || '').toLowerCase();
    const categoryMatch = !category || resource.category_name === category;
    const textMatch = !search || resourceName.includes(search);
    return categoryMatch && textMatch;
  });
}

function renderResources() {
  const filtered = getFilteredResources();
  countEl.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'}`;

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty">No resources match your filter.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((resource) => `
    <article class="resource-card">
      <span class="badge">${resource.category_name || 'Resource'}</span>
      <h2>${resource.name}</h2>
      <p class="meta"><strong>Building:</strong> ${resource.building || 'N/A'}</p>
      <p class="meta"><strong>Floor:</strong> ${resource.floor || 'N/A'}</p>
      <p class="meta"><strong>Capacity:</strong> ${resource.capacity || 'N/A'}</p>
      <p class="meta"><strong>Features:</strong> ${resource.features || 'N/A'}</p>
      <p>${resource.description || 'No description available.'}</p>
      <p class="meta"><strong>Latest status:</strong> ${resource.latest_condition || 'Unknown'}</p>
      <p class="meta"><strong>Recent comment:</strong> ${resource.latest_comment || 'No recent report'}</p>
    </article>
  `).join('');
}

async function loadResources() {
  try {
    const resourceResponse = await fetch('/api/resources');
    const categoryResponse = await fetch('/api/categories');

    const resourceData = await resourceResponse.json();
    const categoryData = await categoryResponse.json();

    if (!resourceData.ok || !Array.isArray(resourceData.resources)) {
      throw new Error('Failed to load resources');
    }

    allResources = resourceData.resources;
    renderCategoryOptions(categoryData.categories || []);
    renderResources();
    setMessage('');
  } catch (error) {
    console.error(error);
    setMessage('Could not load resources. Please try again later.', 'error');
    listEl.innerHTML = '<div class="empty">Unable to load campus resources right now.</div>';
  }
}

qInput.addEventListener('input', renderResources);
categorySelect.addEventListener('change', renderResources);
loadResources();
