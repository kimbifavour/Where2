const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('site-nav');
const mobileNav = window.matchMedia('(max-width: 800px)');

function setMenuOpen(isOpen) {
  siteNav.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
}

navToggle.addEventListener('click', () => {
  setMenuOpen(navToggle.getAttribute('aria-expanded') !== 'true');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobileNav.matches && siteNav.classList.contains('open')) {
    setMenuOpen(false);
    navToggle.focus();
  }
});

mobileNav.addEventListener('change', (event) => {
  if (!event.matches) setMenuOpen(false);
});

document.body.classList.add('nav-enhanced');