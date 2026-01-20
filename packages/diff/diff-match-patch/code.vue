
<template>
  <div class="max-w-md space-y-4">
    <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
      <QuestionMarkCircleIcon class="h-6 w-6 text-indigo-600" /> FAQ
    </h2>

    <Disclosure v-for="item in faqs" :key="item.q" class="border rounded">
      <DisclosureButton class="flex w-full justify-between px-4 py-2 bg-indigo-50 text-left font-medium text-indigo-900">
        {{ item.q }}
        <ChevronUpIcon class="h-5 w-5" />
      </DisclosureButton>
      <DisclosurePanel class="px-4 py-2 text-sm text-gray-700">{{ item.a }}</DisclosurePanel>
    </Disclosure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronUpIcon, QuestionMarkCircleIcon } from '@heroicons/vue/24/solid';
import type { FAQItem } from '../types';

const faqs = ref<FAQItem[]>([
  { q:'如何安装 Tailwind CSS？', a:'可以通过 npm 或 CDN 安装 Tailwind。' },
  { q:'Headless UI 提供什么？', a:'提供无样式可访问组件，用任意 CSS 框架组合。' }
]);
</script>