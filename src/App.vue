<script setup></script>

<template>
  <header class="page site-header">
    <router-link to="/recent" class="brand">Sylvan Liu</router-link>
    <nav>
      <router-link to="/recent">Recent</router-link>
      <router-link to="/item_list">Writing</router-link>
      <router-link to="/about_me">About</router-link>
    </nav>
  </header>

  <main>
    <router-view :key="$route.fullPath" />
  </main>

  <footer class="page site-footer">
    <span>&copy; {{ new Date().getFullYear() }} Sylvan Liu</span>
    <a href="https://github.com/Shan2L" target="_blank" rel="noopener">GitHub</a>
  </footer>
</template>

<style scoped>
.site-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24px;
  padding-top: 48px;
  padding-bottom: 48px;
}

.brand {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--heading);
  text-decoration: none;
}

nav {
  display: flex;
  gap: 24px;
  font-size: 14px;
}

nav a {
  color: var(--muted);
  text-decoration: none;
  transition: color 200ms ease;
}

nav a:hover,
nav a.router-link-active {
  color: var(--heading);
}

main {
  min-height: 60vh;
}

.site-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 96px;
  padding-top: 24px;
  padding-bottom: 48px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--muted);
}

.site-footer a {
  text-decoration: none;
}

.site-footer a:hover {
  color: var(--heading);
}

@media (max-width: 560px) {
  .site-header {
    flex-direction: column;
    gap: 8px;
    padding-top: 32px;
    padding-bottom: 32px;
  }
}
</style>
