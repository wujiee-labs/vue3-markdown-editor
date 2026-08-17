<script setup lang="ts">
import { iconPaths } from './icons'
import type { ToolbarItemName } from './types'

defineProps<{
  name: ToolbarItemName | 'edit' | 'split' | 'preview' | 'fullscreen' | 'exit-fullscreen'
}>()
</script>

<template>
  <svg class="wmd-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path v-for="path in iconPaths[name]" :key="path" :d="path" />
  </svg>
</template>
