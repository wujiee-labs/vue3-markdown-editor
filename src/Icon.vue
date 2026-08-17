<script setup lang="ts">
import { wujieeIconPaths } from './icons'
import type { ToolbarItemName } from './types'

defineProps<{
  name: ToolbarItemName | 'edit' | 'split' | 'preview' | 'fullscreen' | 'exit-fullscreen'
}>()
</script>

<template>
  <svg class="wujiee-md-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path v-for="path in wujieeIconPaths[name]" :key="path" :d="path" />
  </svg>
</template>
