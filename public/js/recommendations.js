const categorySelect = document.getElementById('category');
const buildingSelect = document.getElementById('building');
const preferenceSelect = document.getElementById('preference');
const message = document.getElementById('message');

let resources = [];
let conditions = [];

function updatePreferences() {
  const categoryId = categorySelect.value;

  buildingSelect.replaceChildren(
    new Option('Any location', '')
  );

  preferenceSelect.replaceChildren(
    new Option('Choose a condition', '')
  );

  buildingSelect.disabled = !categoryId;
  preferenceSelect.disabled = !categoryId;

  if (!categoryId) {
    return;
  }

  const buildings = new Set(
    resources
      .filter(resource =>
        String(resource.category_id) === categoryId
      )
      .map(resource => resource.building)
  );

  [...buildings].sort().forEach(building => {
    buildingSelect.add(new Option(building, building));
  });

  conditions
    .filter(condition =>
      String(condition.category_id) === categoryId
    )
    .forEach(condition => {
      preferenceSelect.add(
        new Option(condition.label, condition.id)
      );
    });
}

async function loadPreferences() {
  message.textContent = 'Loading preferences...';

  try {
    const response = await fetch('/api/report-options');
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error('Unable to load preferences.');
    }

    resources = data.resources;
    conditions = data.conditions;

    const categories = new Map();

    resources.forEach(resource => {
      categories.set(
        resource.category_id,
        resource.category_name
      );
    });

    categories.forEach((name, id) => {
      categorySelect.add(new Option(name, id));
    });

    categorySelect.disabled = false;
    message.textContent = '';
  } catch (error) {
    message.textContent = 'Could not load preferences. Please try again.';
  }
}

const recommendationForm = document.getElementById('recommendationForm');
const recommendButton = document.getElementById('recommendButton');
const results = document.getElementById('results');

function updateButton() {
  recommendButton.disabled =
    !categorySelect.value || !preferenceSelect.value;
}

function renderRecommendations(recommendations) {
  results.replaceChildren();

  if (recommendations.length === 0) {
    results.textContent = 'No resources match your preferences.';
    return;
  }

  recommendations.forEach((resource, index) => {
    const card = document.createElement('article');
    card.className = 'resource-card';

    const heading = document.createElement('h3');
    heading.textContent = resource.score === null
        ? resource.name
        : `${index + 1}. ${resource.name}`;

    const location = document.createElement('p');
    location.textContent =
      `${resource.building} · ${resource.floor || 'N/A'}`;

    const score = document.createElement('p');
    score.className = 'recommendation-score';

    if (resource.score === null) {
        score.dataset.level = 'unknown';
    } else if (resource.score >= 67) {
        score.dataset.level = 'high';
    } else if (resource.score >= 34) {
        score.dataset.level = 'medium';
    } else {
        score.dataset.level = 'low';
    }

    score.textContent = resource.score === null
      ? 'Unknown status'
      : `${resource.score}% match`;

    const description = document.createElement('p');
    description.textContent =
      resource.description || 'No description available.';

    const explanation = document.createElement('p');
    explanation.textContent = resource.explanation;

    card.append(
      heading,
      location,
      score,
      description,
      explanation
    );

    results.appendChild(card);
  });
}

async function findRecommendations(event) {
  event.preventDefault();

  const params = new URLSearchParams({
    category_id: categorySelect.value,
    condition_id: preferenceSelect.value,
    building: buildingSelect.value,
  });

  recommendButton.disabled = true;
  categorySelect.disabled = true;
  buildingSelect.disabled = true;
  preferenceSelect.disabled = true;

  message.textContent = 'Finding recommendations...';
  results.replaceChildren();

  try {
    const response = await fetch(
      `/api/recommendations?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'Unable to load recommendations.');
    }

    renderRecommendations(data.recommendations);

    const unknownCount = data.recommendations.filter(
        resource => resource.score === null
    ).length;

    message.textContent =
        `${data.recommendations.length} resources found, ` +
        `${unknownCount} with unknown conditions.`;

  } catch (error) {
    message.textContent = error.message;
  } finally {
    categorySelect.disabled = false;
    buildingSelect.disabled = false;
    preferenceSelect.disabled = false;

    updateButton();
  }
}

function resetResults() {
  results.textContent = 'Select Find recommendations to update your results.';
  message.textContent = '';
}

categorySelect.addEventListener('change', () => {
  updatePreferences();
  updateButton();
  resetResults();
});

preferenceSelect.addEventListener('change', () => {
  updateButton();
  resetResults();
});

buildingSelect.addEventListener('change', resetResults);

recommendationForm.addEventListener('submit', findRecommendations);

loadPreferences();