<script setup>
import PostList from '@/components/PostList.vue'

const experience = [
  {
    period: '2025.09 – Present',
    org: 'AMD',
    role: 'AI Infrastructure Engineer',
    note: 'RCCL optimization and large-model deployment on Radeon GPUs.',
  },
  {
    period: '2024.12 – 2025.12',
    org: 'North Carolina State University',
    role: 'Remote Research Intern',
    note: 'Reducing peak intermediate memory in large vision model inference, with Oregon State University.',
  },
  {
    period: '2023.07 – 2025.09',
    org: 'Innosilicon',
    role: 'Software Engineer',
    note: 'Led iFormer, a high-performance operator library for large language models, built from scratch.',
  },
  {
    period: '2022.01 – 2023.01',
    org: 'Intel, Shanghai',
    role: 'Intern, CESG',
    note: 'Recommendation model optimization and the CI/CD system of the open-source project',
    link: { text: 'DeepRec', href: 'https://github.com/DeepRec-AI/DeepRec' },
  },
]

const awards = [
  { year: '2026', title: 'Executive Spotlight Award', org: 'AMD' },
  { year: '2025', title: 'The only "A" performance rating among peers at the same level' },
]
</script>

<template>
  <div class="page">
    <section class="hero">
      <img
        class="avatar"
        src="https://avatars.githubusercontent.com/u/38881602?s=240&v=4"
        alt="Sylvan Liu"
        width="88"
        height="88"
      />
      <h1>Hi, I'm Sylvan.</h1>
      <p class="lede">
        AI infrastructure engineer at AMD, working on communication libraries and large-model
        deployment on GPUs.
      </p>
      <p>
        Previously I led the development of a high-performance computing library at Innosilicon, a
        domestic GPU company, implementing key operators for large language models. I have also
        collaborated with researchers from North Carolina State University and Oregon State
        University on memory optimization for large vision models, and interned at Intel Shanghai,
        where I worked on recommendation model optimization and the CI/CD system of an open-source
        project.
      </p>
    </section>

    <section class="block">
      <h2 class="section-label">Experience</h2>
      <ul class="rows">
        <li v-for="item in experience" :key="item.org">
          <span class="when">{{ item.period }}</span>
          <div>
            <div class="what">
              {{ item.org }} <span class="sub">&middot; {{ item.role }}</span>
            </div>
            <p class="note">
              {{ item.note }}
              <template v-if="item.link">
                {{ ' ' }}<a :href="item.link.href" target="_blank" rel="noopener">{{
                  item.link.text
                }}</a>.
              </template>
            </p>
          </div>
        </li>
      </ul>
    </section>

    <section class="block">
      <h2 class="section-label">Awards</h2>
      <ul class="rows">
        <li v-for="item in awards" :key="item.title">
          <span class="when">{{ item.year }}</span>
          <div class="what">
            {{ item.title }} <span v-if="item.org" class="sub">&middot; {{ item.org }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="section-label">Recent writing</h2>
      <PostList :limit="10" />
    </section>
  </div>
</template>

<style scoped>
.hero {
  margin-bottom: 72px;
}

.avatar {
  display: block;
  width: 88px;
  height: 88px;
  margin-bottom: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  object-fit: cover;
}

h1 {
  margin: 0 0 24px;
  font-family: var(--serif);
  font-size: clamp(36px, 7vw, 52px);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--heading);
}

.lede {
  font-size: 19px;
  color: var(--heading);
}

p {
  margin: 0 0 16px;
}

.block {
  margin-bottom: 64px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border);
}

.rows li {
  display: grid;
  grid-template-columns: 152px minmax(0, 1fr);
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}

.when {
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.what {
  color: var(--heading);
}

.sub {
  color: var(--muted);
}

.note {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--muted);
}

.note a {
  color: var(--heading);
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 3px;
}

.note a:hover {
  text-decoration-color: currentColor;
}

@media (max-width: 560px) {
  .rows li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
