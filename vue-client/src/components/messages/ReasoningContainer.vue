<template>
  <div
    class="reasoning-container"
    :class="{ 'collapsed': isCollapsed }"
    @click="$emit('toggle')"
  >
    <div class="reasoning-header">
      推理过程
      <span class="toggle-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>
    <pre v-show="!isCollapsed" class="reasoning-content">{{ content }}</pre>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  content: string;
  isCollapsed: boolean;
}>();

defineEmits(['toggle']);
</script>

<style scoped>
@import '../../assets/styles/reasoning.css';
</style> 