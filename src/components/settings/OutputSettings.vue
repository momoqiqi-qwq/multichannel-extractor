<script setup lang="ts">
import { CHANNEL_CATEGORIES } from '../../config/appearance';
import { useChannelStore } from '../../stores/channels';
const store = useChannelStore();
function activateDefaultCustomPath(): void { store.appSettings.defaultUseArchiveDirectory = false; }
</script>

<template>
<section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>新通道默认输出位置</h3>
                <p>以后创建的通道会使用这里的设置，已有通道不受影响。</p>
              </div>
            </div>
            <div class="settings-detail-callout detailed-explanation"><b>默认值与现有通道</b><span>这里的设置只决定“之后新建通道”采用什么初始地址和规则，不会批量覆盖已经存在的通道。已有通道请到左侧“通道解压地址”页面集中修改。</span></div>
            <div class="default-output-card">
              <div class="output-mode-switch wide" role="group" aria-label="默认解压位置模式">
                <button type="button" :class="{ active: store.appSettings.defaultUseArchiveDirectory }" :aria-pressed="store.appSettings.defaultUseArchiveDirectory" @click="store.appSettings.defaultUseArchiveDirectory = true">跟随压缩包</button>
                <button type="button" :class="{ active: !store.appSettings.defaultUseArchiveDirectory }" :aria-pressed="!store.appSettings.defaultUseArchiveDirectory" @click="store.appSettings.defaultUseArchiveDirectory = false">指定目录</button>
              </div>
              <div class="path-row">
                <input
                  v-model="store.appSettings.defaultDestination"
                  class="path-input"
                  placeholder="默认指定目录，可直接粘贴路径"
                  @focus="activateDefaultCustomPath"
                  @input="activateDefaultCustomPath"
                  @blur="store.commitDefaultDestination"
                  @keydown.enter.prevent="store.commitDefaultDestination"
                />
                <button class="path-browse" type="button" title="选择默认目录" @click="store.browseDefaultDestination">
                  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                </button>
              </div>
              <p class="settings-note">即使当前选择“跟随压缩包”，这里填写的路径也会保留，切换到“指定目录”时可继续使用。</p>
            </div>
          </section>

          <section class="settings-section settings-two-column">
            <div class="settings-panel">
              <h3>文件落地规则</h3>
              <div class="settings-field">
                <span>默认输出容器</span>
                <div class="output-mode-switch wide" role="group" aria-label="默认输出容器">
                  <button type="button" :class="{ active: !store.appSettings.defaultCreateArchiveSubfolder }" @click="store.appSettings.defaultCreateArchiveSubfolder = false">直接写入</button>
                  <button type="button" :class="{ active: store.appSettings.defaultCreateArchiveSubfolder }" @click="store.appSettings.defaultCreateArchiveSubfolder = true">压缩包同名文件夹</button>
                </div>
              </div>
              <label class="switch-row">
                <span><b>避免同名根目录重复嵌套</b><small>输出文件夹与归档根目录同名时自动去掉一层</small></span>
                <input v-model="store.appSettings.defaultDeduplicateArchiveRoot" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>跳过外层时自动直接写入</b><small>选择“跳过外层”后自动关闭压缩包同名输出文件夹</small></span>
                <input v-model="store.appSettings.autoDirectForSkipOuter" type="checkbox" />
              </label>
              <label class="settings-field">
                <span>重名文件处理</span>
                <select v-model="store.appSettings.defaultCollisionPolicy" class="option-input">
                  <option value="overwrite">直接替换已有文件（默认）</option>
                  <option value="rename">保留两份并自动重命名</option>
                  <option value="skip">保留已有文件并跳过</option>
                </select>
              </label>
              <label class="settings-field">
                <span>默认分类</span>
                <select v-model="store.appSettings.defaultCategory" class="option-input">
                  <option v-for="category in CHANNEL_CATEGORIES" :key="category.id" :value="category.id">{{ category.name }}</option>
                </select>
              </label>
              <label class="settings-field">
                <span>默认队列排序</span>
                <select v-model="store.appSettings.defaultFileSort" class="option-input">
                  <option value="manual">导入顺序</option>
                  <option value="name">按名称</option>
                  <option value="size">按大小</option>
                  <option value="status">按状态</option>
                </select>
              </label>
              <label class="switch-row">
                <span><b>默认过滤系统垃圾文件</b><small>跳过 __MACOSX、.DS_Store、Thumbs.db</small></span>
                <input v-model="store.appSettings.defaultSkipJunkFiles" type="checkbox" />
              </label>
              <label class="switch-row">
                <span><b>默认保留空目录</b><small>保留归档中的空文件夹</small></span>
                <input v-model="store.appSettings.defaultKeepEmptyDirectories" type="checkbox" />
              </label>
            </div>

            <div class="settings-panel">
              <h3>目录层级</h3>
              <label class="settings-field">
                <span>默认层级规则</span>
                <select v-model="store.appSettings.defaultDepthMode" class="option-input">
                  <option value="preserve">保留结构</option>
                  <option value="flatten">展平层级</option>
                  <option value="skipOuter">跳过外层</option>
                </select>
              </label>
              <label class="settings-field">
                <span>默认保留深度</span>
                <input v-model.number="store.appSettings.defaultDepth" class="option-input" type="number" min="0" max="32" />
              </label>
              <p class="settings-note">层级规则只处理压缩包内部路径；“输出容器”决定目标目录外面是否再加一层压缩包名称。</p>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <div>
                <h3>最近使用的目录</h3>
                <p>选择目录或确认手动输入后自动加入，当前最多保留 {{ store.appSettings.maxRecentDestinations }} 条。</p>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" :disabled="store.recentDestinations.length === 0" @click="store.clearRecentDestinations">清空</button>
            </div>
            <label class="settings-field recent-limit-field">
              <span>最多保留目录数</span>
              <input v-model.number="store.appSettings.maxRecentDestinations" class="number-input" type="number" min="3" max="30" />
            </label>
            <div v-if="store.recentDestinations.length" class="recent-path-list">
              <code v-for="path in store.recentDestinations" :key="path">{{ path }}</code>
            </div>
            <div v-else class="settings-empty">还没有最近目录。</div>
          </section>
</template>
