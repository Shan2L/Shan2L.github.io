<script setup>
import PostList from '@/components/PostList.vue'
</script>

<template>
  <div class="page">
    <h1>Writing</h1>
    <PostList />
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 32px;
  font-family: var(--serif);
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--heading);
}
</style>
