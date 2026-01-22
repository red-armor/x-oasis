
<templabe>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
      <HomeIcon class="h-6 w-6 text-indigo-600" /> 欢迎
    </h2>

    <!-- 图片示例：随机占位图 -->
    <img
      src="https://picsum.photos/seed/vebox/400/200"
      alt="示例图片"
      class="rounded-md shadow"
    />

    <!-- Switch 示例 -->
    <div class="flex items-center gap-4">
      <Switch v-model="enabled" class="relative inline-flex h-6 w-11 items-center rounded-full" :class="enabled ? 'bg-indigo-600' : 'bg-gray-300'">
        <span class="sr-only">Enable notifications</span>
        <span :class="enabled ? 'translate-x-6' : 'translate-x-1'" class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
      </Switch>
      <span class="text-sm text-gray-700">通知 {{ enabled ? '开启' : '关闭' }}</span>
    </div>

    <!-- Disclosure 示例 -->
    <Disclosure as="div" class="w-full">
      <DisclosureButton class="flex w-full justify-between rounded-lg bg-indigo-50 px-4 py-2 text-left text-sm font-medium text-indigo-900 hover:bg-indigo-100">
        <span>查看更多介绍</span>
        <ChevronUpIcon class="h-5 w-5" />
      </DisclosureButton>
      <DisclosurePanel class="px-4 pt-4 pb-2 text-sm text-gray-600">
        这是一个使用 <strong>Headless UI</strong> + <strong>Heroicons</strong> 构建的 Vue3 示例。
      </DisclosurePanel>
    </Disclosure>

    <!-- Disabled button 示例，用于测试 click-select 兜底逻辑 -->
    <button class="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed" disabled>禁用按钮</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HomeIcon, ChevronUpIcon } from '@heroicons/vue/24/solid';
import { Switch, Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';

const enabled = ref(true);
</script>