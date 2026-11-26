<script setup>
import { computed } from 'vue'
import { posts, formatDate } from '@/posts.js'

const props = defineProps({ limit: { type: Number, default: 0 } })
const items = computed(() => (props.limit ? posts.slice(0, props.limit) : posts))
</script>

<template>
  <ul class="post-list">
    <li v-for="post in items" :key="post.fileName">
      <router-link :to="{ path: '/postContent', query: { fileName: post.fileName } }">
        <time>{{ formatDate(post.date) }}</time>
        <span class="title">{{ post.title }}</span>
      </router-link>
    </li>
    <li v-if="!items.length" class="empty">Nothing here yet.</li>
  </ul>
</template>

<style scoped>
.post-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border);
}

.post-list li {
  border-bottom: 1px solid var(--border);
}

.post-list a {
  display: flex;
  align-items: baseline;
  gap: 24px;
  padding: 16px 0;
  text-decoration: none;
}

time {
  flex: 0 0 auto;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.title {
  color: var(--heading);
  transition: color 200ms ease;
}

.post-list a:hover .title {
  color: var(--accent);
}

.empty {
  padding: 16px 0;
  color: var(--muted);
}

@media (max-width: 560px) {
  .post-list a {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
