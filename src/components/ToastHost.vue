<script setup lang="ts">
import { useChannelStore } from '../stores/channels';

const store = useChannelStore();
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <article v-for="toast in store.toasts" :key="toast.id" class="toast-card" :class="`toast-${toast.level}`">
      <div class="toast-icon" aria-hidden="true">
        <svg v-if="toast.level === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 13l4 4L19 7" /></svg>
        <svg v-else-if="toast.level === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
        <svg v-else-if="toast.level === 'warn'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v5M12 17h.01M10.3 3.3l-8 14A2 2 0 004 20h16a2 2 0 001.7-2.7l-8-14a2 2 0 00-3.4 0z" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      </div>
      <div class="toast-copy">
        <b>{{ toast.title }}</b>
        <span v-if="toast.message">{{ toast.message }}</span>
      </div>
      <button type="button" aria-label="关闭提示" @click="store.dismissToast(toast.id)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </article>
  </div>
</template>
