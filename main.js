document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;
  const htmlElement = document.documentElement;

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  function setTheme(theme) {
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', false);
      });
    });

    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target) && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', false);
      }
    });
  }

  const copyBtn = document.getElementById('copyBtn');
  const emailText = document.getElementById('emailText');
  const copyToast = document.getElementById('copyToast');

  if (copyBtn && emailText) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(emailText.textContent.trim());
        if (copyToast) copyToast.textContent = '¡Copiado al portapapeles!';
        copyBtn.textContent = '¡Copiado!';

        setTimeout(() => {
          if (copyToast) copyToast.textContent = '';
          copyBtn.textContent = 'Copiar correo';
        }, 2500);
      } catch (err) {
        if (copyToast) copyToast.textContent = 'Error al copiar automáticamente. Cópialo manualmente.';
      }
    });
  }

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12
    });

    reveals.forEach(element => observer.observe(element));
  } else {
    reveals.forEach(element => element.classList.add('active'));
  }

  const yearElement = document.getElementById('currentYear');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const typingElement = document.getElementById('typingText');
  const textToType = "César Hernández Garrido";
  let charIndex = 0;
  let isDeleting = false;
  const typingSpeed = 110;
  const erasingSpeed = 65;
  const pauseEnd = 2400;
  const pauseStart = 500;

  function typeEffect() {
    if (!typingElement) return;

    if (!isDeleting && charIndex <= textToType.length) {
      typingElement.textContent = textToType.substring(0, charIndex);
      charIndex++;

      if (charIndex > textToType.length) {
        isDeleting = true;
        setTimeout(typeEffect, pauseEnd);
        return;
      }
      setTimeout(typeEffect, typingSpeed);
    } else if (isDeleting && charIndex >= 0) {
      typingElement.textContent = textToType.substring(0, charIndex);
      charIndex--;

      if (charIndex < 0) {
        isDeleting = false;
        charIndex = 0;
        setTimeout(typeEffect, pauseStart);
        return;
      }
      setTimeout(typeEffect, erasingSpeed);
    }
  }

  typeEffect();
});