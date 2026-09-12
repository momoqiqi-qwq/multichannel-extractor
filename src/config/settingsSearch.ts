import { APP_RELEASE_NAME, APP_VERSION } from './version';

export type TabId = 'general' | 'appearance' | 'behavior' | 'output' | 'destinations' | 'inbox' | 'reliability' | 'recovery' | 'developer' | 'maintenance' | 'about';

export interface SettingsTab { id: TabId; label: string; icon: string; keywords: string; }

export interface SettingSearchItem {
  id: string;
  tab: TabId;
  label: string;
  description: string;
  aliases: string[];
  targetText?: string;
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'general', label: '常规', icon: '◉', keywords: '常规 默认 基础 首页 方案 cg mr jc sy fa' },
  { id: 'appearance', label: '界面与字体', icon: '✦', keywords: '界面 字体 主题 背景 图标 开关 按钮 透明 jm zt zt bj kg an' },
  { id: 'behavior', label: '操作与导航', icon: '↔', keywords: '操作 拖动 窗口 导航 右键 快捷键 并发 cz dh kjj bf' },
  { id: 'output', label: '输出默认值', icon: '⇲', keywords: '输出 目录 层级 重名 默认 sc ml cj cm mr' },
  { id: 'destinations', label: '通道解压地址', icon: '⌂', keywords: '通道 解压 地址 输出 目录 路径 td jy dz sc ml lj' },
  { id: 'inbox', label: '关键词收件', icon: '⌕', keywords: '下载 目录 关键词 筛选 版本 最新 收件 自动扫描 gjc xz bb sj' },
  { id: 'reliability', label: '可靠性', icon: '⌁', keywords: '可靠性 删除 历史 日志 安全 klx sc ls rz aq' },
  { id: 'recovery', label: '自检与恢复', icon: '⌕', keywords: '自检 预检查 恢复 断点 暂停 优先级 剩余时间 zj hf dd zt yxj eta' },
  { id: 'developer', label: '项目工具', icon: '⌘', keywords: '项目 Claude DAT 工具 cli xm gj' },
  { id: 'maintenance', label: '模板与维护', icon: '▤', keywords: '模板 导入 导出 维护 重置 配置 mb dr dc wh cz pz' },
  { id: 'about', label: '说明与版本', icon: '▣', keywords: '说明 版本 关于 检查 help version bb gy' },
];

export const SETTINGS_SEARCH_INDEX: SettingSearchItem[] = [
  { id: 'profile-safe', tab: 'general', label: '稳妥模式', description: '低并发、完整自检与危险操作确认', aliases: ['wt', 'wtms', 'safe', 'anquan'] },
  { id: 'profile-balanced', tab: 'general', label: '均衡模式', description: '日常推荐的默认设置组合', aliases: ['jh', 'jhms', 'balanced', 'default'] },
  { id: 'profile-fast', tab: 'general', label: '高效模式', description: '高并发并减少提示', aliases: ['gx', 'gxms', 'fast'] },
  { id: 'profile-minimal', tab: 'general', label: '极简模式', description: '减少说明与视觉占用', aliases: ['jj', 'jjms', 'minimal'] },
  { id: 'hide-descriptions', tab: 'general', label: '关闭基础描述', description: '隐藏简短辅助说明', aliases: ['gbms', 'ms', 'desc'] },
  { id: 'detailed-explanations', tab: 'general', label: '显示详细解释', description: '显示设置用途、影响范围和注意事项', aliases: ['xsxxjs', 'xxjs', 'js', 'help', 'detail'] },
  { id: 'output-preview', tab: 'general', label: '开始前输出预览', description: '写入前确认输出路径', aliases: ['ksqscyl', 'scyl', 'preview'] },
  { id: 'pause-resume', tab: 'general', label: '允许暂停与继续', description: '长任务在安全检查点暂停', aliases: ['yxztjx', 'ztjx', 'pause'] },
  { id: 'eta', tab: 'general', label: '显示剩余时间', description: '任务中心显示动态 ETA', aliases: ['xssysj', 'sysj', 'eta'] },
  { id: 'priority', tab: 'general', label: '文件优先级', description: '高、普通、低三级任务调度', aliases: ['wjyxj', 'yxj', 'priority'] },

  { id: 'theme', tab: 'appearance', label: '主题', description: '切换应用主题配色', aliases: ['zt', 'theme'] },
  { id: 'reset-appearance', tab: 'appearance', label: '恢复默认外观', description: '重置主题、字体、背景和入口显示', aliases: ['hfmrgw', 'mrgw', 'resetappearance'] },
  { id: 'visibility-all', tab: 'appearance', label: '全部打开', description: '打开全部工作区显示开关', aliases: ['qbkg', 'qbxss', 'qbx', 'showall'] },
  { id: 'visibility-focused', tab: 'appearance', label: '精简开关', description: '只保留主要工作区控件', aliases: ['jjkg', 'jjxs', 'focused', 'minimalui'] },
  { id: 'font', tab: 'appearance', label: '字体方案', description: '系统、微软雅黑、等宽或自定义字体', aliases: ['ztfa', 'font', 'ziti'] },
  { id: 'background', tab: 'appearance', label: '显示背景图片', description: '启用或关闭自定义背景', aliases: ['xsbjtp', 'bjtp', 'bg'] },
  { id: 'density', tab: 'appearance', label: '界面密度', description: '紧凑、舒适、宽松布局', aliases: ['jmmd', 'md', 'density'] },
  { id: 'channel-sort', tab: 'appearance', label: '通道排序', description: '按手动、名称、分类或状态排序', aliases: ['tdpx', 'px', 'sort'] },
  { id: 'group-category', tab: 'appearance', label: '按分类分组', description: '主界面显示分类标题', aliases: ['aflfz', 'flfz', 'group'] },
  { id: 'compact-topbar', tab: 'appearance', label: '顶栏紧凑模式', description: '压缩顶部按钮间距', aliases: ['dljcms', 'dljc', 'topbar'] },
  { id: 'sticky-toolbar', tab: 'appearance', label: '工具栏吸顶', description: '滚动时保留工作区工具栏', aliases: ['gjlxd', 'gjlxdd', 'sticky'] },
  { id: 'reduce-motion', tab: 'appearance', label: '减少动画', description: '降低动画与视觉干扰', aliases: ['jsdh', 'dh', 'motion'] },
  { id: 'show-file-size', tab: 'appearance', label: '显示文件大小', description: '文件列表显示容量', aliases: ['xswjdx', 'wjdx', 'size'] },
  { id: 'show-file-format', tab: 'appearance', label: '显示压缩格式', description: '显示 ZIP、7Z、RAR 格式标签', aliases: ['xsysgs', 'ysgs', 'format'] },
  { id: 'topbar-concurrency', tab: 'appearance', label: '顶部并发开关', description: '显示或隐藏顶栏并发滑块', aliases: ['xsdbbfkz', 'dbbf', 'bf', 'kg', 'concurrency'] },
  { id: 'quick-settings', tab: 'appearance', label: '快捷设置开关', description: '显示或隐藏快捷设置入口', aliases: ['xskjsz', 'kjsz', 'kg', 'quick'] },
  { id: 'project-shortcut', tab: 'appearance', label: '项目入口开关', description: '显示或隐藏顶栏项目入口', aliases: ['xsxmrk', 'xmrk', 'kg', 'project'] },
  { id: 'task-shortcut', tab: 'appearance', label: '任务入口开关', description: '显示或隐藏顶栏任务入口', aliases: ['xsrwrk', 'rwrk', 'kg', 'task'] },
  { id: 'logs-shortcut', tab: 'appearance', label: '日志入口开关', description: '显示或隐藏顶栏日志入口', aliases: ['xsrzrk', 'rzrk', 'kg', 'log'] },
  { id: 'workspace-search', tab: 'appearance', label: '工作区搜索开关', description: '显示或隐藏主工具栏搜索框', aliases: ['xsgzqss', 'gzqss', 'kg', 'search'] },
  { id: 'workspace-filter', tab: 'appearance', label: '工作区筛选开关', description: '显示或隐藏分类与状态筛选', aliases: ['xsgzqsx', 'gzqsx', 'kg', 'filter'] },
  { id: 'shortcut-hints', tab: 'appearance', label: '快捷键提示开关', description: '显示或隐藏工具栏快捷键说明', aliases: ['xskjjts', 'kjjts', 'kg', 'shortcut'] },
  { id: 'expand-collapse-control', tab: 'appearance', label: '全部展开开关', description: '显示或隐藏全部展开与收起控件', aliases: ['qbzk', 'zksq', 'kg', 'expand'] },
  { id: 'global-start-control', tab: 'appearance', label: '全部开始开关', description: '显示或隐藏顶栏主开始控件', aliases: ['qbks', 'kskg', 'kg', 'start'] },
  { id: 'inbox-scan-control', tab: 'appearance', label: '扫描收件开关', description: '显示或隐藏工作区扫描收件入口', aliases: ['smsj', 'smkg', 'kg', 'scan'] },
  { id: 'workspace-cleanup-controls', tab: 'appearance', label: '清理 / 重试开关', description: '显示或隐藏失败重试和完成项清理控件', aliases: ['qlcs', 'qkcs', 'kg', 'cleanup'] },
  { id: 'add-channel-control', tab: 'appearance', label: '新建通道开关', description: '显示或隐藏工作区底部新建通道区域', aliases: ['xjtd', 'tdkg', 'kg', 'newchannel'] },
  { id: 'channel-order-controls', tab: 'appearance', label: '通道排序开关', description: '显示或隐藏通道上移与下移控件', aliases: ['tdpxkg', 'pxkg', 'kg', 'order'] },
  { id: 'channel-duplicate-control', tab: 'appearance', label: '通道复制开关', description: '显示或隐藏通道复制控件', aliases: ['tdfz', 'fzkg', 'kg', 'duplicate'] },
  { id: 'channel-delete-control', tab: 'appearance', label: '通道删除开关', description: '显示或隐藏通道删除控件', aliases: ['tdsc', 'sckg', 'kg', 'delete'] },
  { id: 'workspace-width', tab: 'appearance', label: '工作区宽度', description: '铺满、宽屏居中或专注窄屏布局', aliases: ['gzqkd', 'kd', 'layout', 'width'] },
  { id: 'command-palette-control', tab: 'appearance', label: '全局命令开关', description: '显示或隐藏 Ctrl/Cmd+K 全局命令入口', aliases: ['qjml', 'mlkg', 'kg', 'command', 'cmdk'] },
  { id: 'recent-actions-control', tab: 'appearance', label: '最近操作开关', description: '显示或隐藏最近操作入口', aliases: ['zjcz', 'lskg', 'kg', 'history'] },
  { id: 'extraction-history-control', tab: 'appearance', label: '解压历史开关', description: '显示或隐藏顶栏解压历史入口', aliases: ['jy', 'jylskg', 'jyls', 'kg', 'extractionhistory'] },
  { id: 'undo-control', tab: 'appearance', label: '撤销开关', description: '显示或隐藏撤销入口', aliases: ['cx', 'cxkg', 'kg', 'undo'] },
  { id: 'automation-control', tab: 'appearance', label: '通道自动化方案开关', description: '显示或隐藏通道自动化快捷方案', aliases: ['tdzdh', 'zdhfa', 'kg', 'automation'] },
  { id: 'brand-subtitle-control', tab: 'appearance', label: '品牌副标题开关', description: '控制左上角副标题', aliases: ['ppt', 'fbt', 'kg', 'subtitle'] },
  { id: 'column-header-control', tab: 'appearance', label: '列标题开关', description: '显示或隐藏通道列表列标题', aliases: ['lbt', 'kg', 'header'] },
  { id: 'toolbar-summary-control', tab: 'appearance', label: '工具栏统计开关', description: '显示或隐藏当前通道数量统计', aliases: ['gjltj', 'tjkg', 'kg', 'summary'] },
  { id: 'statusbar-control', tab: 'appearance', label: '底部状态栏开关', description: '显示或隐藏底部工作区统计栏', aliases: ['dbztl', 'ztl', 'kg', 'statusbar'] },

  { id: 'max-concurrency', tab: 'behavior', label: '最大并发数', description: '同时运行的最大解压任务数', aliases: ['zdbfs', 'bfs', 'bf', 'concurrency'] },
  { id: 'queue-strategy', tab: 'behavior', label: '队列调度方式', description: '通道轮询或按通道顺序', aliases: ['dlddfs', 'ddfs', 'queue'] },
  { id: 'duplicate-import', tab: 'behavior', label: '重复导入策略', description: '忽略、替换或允许重复文件', aliases: ['cfdrcl', 'cfdr', 'duplicate'], targetText: '重复文件导入' },
  { id: 'auto-start', tab: 'behavior', label: '导入后自动开始', description: '新通道的自动开始默认值', aliases: ['drhzdkss', 'zdks', 'autostart'], targetText: '新通道默认自动开始' },
  { id: 'scan-latest-empty-start', tab: 'behavior', label: '空队列开始时扫描最新版', description: '没有压缩包时先扫描关键词收件目录并自动开始', aliases: ['kdlkssmzx', 'kdl', 'smzx', 'zxbb', 'qd', 'startscan'] },
  { id: 'confirm-delete', tab: 'behavior', label: '删除前确认', description: '删除通道前弹出确认', aliases: ['scqqr', 'scqr', 'delete'] },
  { id: 'success-toast', tab: 'behavior', label: '显示成功通知', description: '批次成功后显示 Toast', aliases: ['xscgtz', 'cgtz', 'toast'] },
  { id: 'error-toast', tab: 'behavior', label: '显示错误通知', description: '失败任务显示 Toast', aliases: ['xscwtz', 'cw', 'error'] },
  { id: 'log-retention', tab: 'behavior', label: '日志保留条数', description: '控制日志最多保存多少条', aliases: ['rzblts', 'rz', 'log'] },

  { id: 'default-output', tab: 'output', label: '新通道默认输出位置', description: '跟随压缩包或指定目录', aliases: ['xtdmrscwz', 'mrsc', 'output'] },
  { id: 'channel-destinations', tab: 'destinations', label: '每个通道的解压地址', description: '集中查看和修改所有通道的解压位置', aliases: ['tdjydz', 'jydz', 'tdml', 'dz', 'path'], targetText: '通道解压地址' },

  { id: 'collision', tab: 'output', label: '重名文件处理', description: '替换、重命名或跳过', aliases: ['cmwjcl', 'cmcl', 'collision'] },
  { id: 'depth-mode', tab: 'output', label: '默认层级规则', description: '保留结构、展平或跳过外层', aliases: ['mrcjgz', 'cjgz', 'depth'] },
  { id: 'recent-limit', tab: 'output', label: '最多保留目录数', description: '最近目录历史上限', aliases: ['zdbtmls', 'mls', 'recent'] },

  { id: 'default-inbox', tab: 'inbox', label: '默认收件目录', description: '关键词扫描默认目录', aliases: ['mrsjml', 'sjml', 'inbox'] },
  { id: 'match-mode', tab: 'inbox', label: '默认匹配方式', description: '匹配全部或任一关键词', aliases: ['mrppfs', 'ppfs', 'match'] },
  { id: 'scan-on-launch', tab: 'inbox', label: '启动时自动扫描', description: '启动后扫描已配置收件通道', aliases: ['qd', 'qdszdsm', 'zdsm', 'scan'] },
  { id: 'scan-history', tab: 'inbox', label: '通道扫描历史', description: '通道卡片上的「历史」按钮，可查看并把之前扫描到的版本重新加入队列', aliases: ['tdsmls', 'smls', 'tdls', 'smzs', 'scanhistory', 'history'] },
  { id: 'scan-auto-add', tab: 'inbox', label: '扫描后自动加入推荐文件', description: '扫描结果自动进入队列', aliases: ['smhzdjrtjwj', 'zdjr', 'autoadd'] },
  { id: 'replace-queue', tab: 'inbox', label: '扫描结果替换待处理队列', description: '用扫描结果替换未运行队列', aliases: ['smjgtxdcldl', 'thdl', 'replace'] },

  { id: 'task-history', tab: 'reliability', label: '任务历史保留数量', description: '任务中心历史记录上限，超出后丢弃最早的记录', aliases: ['rwlsblsl', 'rwls', 'lsblsl', 'history'] },
  { id: 'extraction-history-limit', tab: 'reliability', label: '解压历史显示条数', description: '解压历史入口显示最近几次解压', aliases: ['jyzsxsl', 'jyxs', 'jyzs', 'jyls', 'ls', 'extractionhistory'] },
  { id: 'open-extraction-history', tab: 'reliability', label: '打开解压历史', description: '查看最近几次解压记录', aliases: ['dkjyls', 'jyls', 'zjjcyl', 'recent'] },
  { id: 'open-task-failure', tab: 'reliability', label: '失败时自动打开任务中心', description: '失败后自动展示任务详情', aliases: ['sbszddkrwzx', 'sbk', 'failure'] },
  { id: 'delete-output-confirm', tab: 'reliability', label: '删除前确认', description: '删除解压结果前确认', aliases: ['scqqr', 'scqr', 'outputdelete'], targetText: '删除前确认' },
  { id: 'overwrite-confirm', tab: 'reliability', label: '覆盖前确认', description: '覆盖型通道开始前确认', aliases: ['fgqqr', 'fgqr', 'overwrite'] },

  { id: 'preflight', tab: 'recovery', label: '启用开始前自检', description: '写盘前检查路径、空间与冲突', aliases: ['qyksqzj', 'zj', 'preflight'] },
  { id: 'disk-check', tab: 'recovery', label: '检查磁盘空间', description: '开始前估算输出空间', aliases: ['jcclkj', 'cpkj', 'disk'] },
  { id: 'auto-resume', tab: 'recovery', label: '启动后自动恢复', description: '自动重新提交可恢复任务', aliases: ['qd', 'qdhzdhf', 'zdhf', 'resume'] },
  { id: 'recovery-banner', tab: 'recovery', label: '显示恢复横幅', description: '工作区顶部提醒中断任务', aliases: ['xshfhf', 'hfhf', 'banner'] },

  { id: 'claude-directory', tab: 'developer', label: 'Claude 工具目录', description: '配置 Claude DAT 与 CLI 相关目录', aliases: ['claude', 'cl', 'gjml', 'dat'], targetText: '手动项目文件夹' },
  { id: 'claude-launch', tab: 'developer', label: '一键启动 Claude', description: '在选定项目目录直接启动 Claude', aliases: ['qd', 'yjqd', 'qdclaude', 'launch'], targetText: '一键启动 Claude' },
  { id: 'claude-auto-install', tab: 'developer', label: '启动前刷新 DAT', description: '启动 Claude 前按设置刷新项目 DAT', aliases: ['qd', 'qdqsxdat', 'sxdat', 'dat'] },
  { id: 'claude-verify', tab: 'developer', label: '启动前验证 Claude CLI', description: '运行 Claude 前检查 CLI', aliases: ['qd', 'qdqyzclaudecli', 'yzcli', 'cli'], targetText: '启动前检测 CLI' },

  { id: 'claude-safe-confirm', tab: 'developer', label: '启动前安全确认', description: '启动 Claude 前明确确认工作目录与危险参数', aliases: ['qd', 'qdqaqqr', 'aqqr', 'confirm'] },

  { id: 'export-config', tab: 'maintenance', label: '导出全部配置', description: '备份全局设置、通道与预设', aliases: ['dcqbpz', 'dcpz', 'export'] },
  { id: 'import-config', tab: 'maintenance', label: '导入配置', description: '从备份恢复配置', aliases: ['drpz', 'import'] },
  { id: 'reset-settings', tab: 'maintenance', label: '恢复默认设置', description: '重置全局设置为默认值', aliases: ['hfmrsz', 'mrsz', 'reset'] },
  { id: 'reset-workspace', tab: 'maintenance', label: '重置工作区', description: '清空通道配置和当前队列', aliases: ['czgzq', 'gzq', 'reset'] },
  { id: 'preset-rename', tab: 'maintenance', label: '预设重命名', description: '修改已保存通道预设名称', aliases: ['yscmm', 'cmm', 'renamepreset'], targetText: '通道预设管理' },
  { id: 'preset-copy', tab: 'maintenance', label: '预设复制', description: '复制现有预设为新预设', aliases: ['ysfz', 'fzys', 'copypreset'], targetText: '通道预设管理' },
  { id: 'preset-order', tab: 'maintenance', label: '预设排序', description: '上移或下移预设顺序', aliases: ['yspx', 'pxys', 'orderpreset'], targetText: '通道预设管理' },

  { id: 'version', tab: 'about', label: '应用版本', description: `发布 ${APP_RELEASE_NAME} · 技术版本 v${APP_VERSION}`, aliases: ['yybb', 'bb', 'version'], targetText: '发布版本' },
  { id: 'feature-check', tab: 'about', label: '功能检查', description: '查看主要能力与版本说明', aliases: ['gnjc', 'check', 'feature'] },
];


const SEARCH_ABBREVIATION_PHRASES = [
  ['启动', 'qd'], ['自动', 'zd'], ['扫描', 'sm'], ['恢复', 'hf'], ['开始', 'ks'],
  ['输出', 'sc'], ['文件', 'wj'], ['目录', 'ml'], ['设置', 'sz'], ['默认', 'mr'],
  ['显示', 'xs'], ['隐藏', 'yc'], ['搜索', 'ss'], ['筛选', 'sx'], ['日志', 'rz'],
  ['项目', 'xm'], ['任务', 'rw'], ['工具', 'gj'], ['通道', 'td'], ['并发', 'bf'],
  ['字体', 'zt'], ['主题', 'zt'], ['背景', 'bj'], ['删除', 'sc'], ['确认', 'qr'],
  ['安全', 'aq'], ['检查', 'jc'], ['检测', 'jc'], ['导入', 'dr'], ['导出', 'dc'],
  ['重置', 'cz'], ['清空', 'qk'], ['快捷', 'kj'], ['开关', 'kg'], ['按钮', 'an'], ['版本', 'bb'],
  ['关键词', 'gjc'], ['匹配', 'pp'], ['排序', 'px'], ['优先级', 'yxj'], ['暂停', 'zt'],
  ['继续', 'jx'], ['打开', 'dk'], ['关闭', 'gb'], ['生成', 'sc'], ['维护', 'wh'],
] as const;

export function normalizeSettingsSearchText(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\-_/.,，。:：()（）]+/g, '');
}

export function settingsSearchAbbreviations(value: string): string[] {
  return SEARCH_ABBREVIATION_PHRASES
    .filter(([phrase]) => value.includes(phrase))
    .map(([, abbreviation]) => abbreviation);
}

export function searchSettings(queryValue: string): SettingSearchItem[] {
  const query = normalizeSettingsSearchText(queryValue);
  if (!query) return [];
  return SETTINGS_SEARCH_INDEX
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label, 'zh-CN'))
    .slice(0, 14)
    .map((entry) => entry.item);
}

function searchScore(item: SettingSearchItem, query: string): number {
  const label = normalizeSettingsSearchText(item.label);
  const aliases = item.aliases.map(normalizeSettingsSearchText);
  const description = normalizeSettingsSearchText(item.description);
  const labelAbbreviations = settingsSearchAbbreviations(`${item.label} ${item.targetText ?? ''}`).map(normalizeSettingsSearchText);
  const descriptionAbbreviations = settingsSearchAbbreviations(item.description).map(normalizeSettingsSearchText);
  const tab = SETTINGS_TABS.find((entry) => entry.id === item.tab);
  const category = normalizeSettingsSearchText(`${tab?.label ?? ''}${tab?.keywords ?? ''}`);
  if (label === query || aliases.includes(query)) return 0;
  if (labelAbbreviations.includes(query)) return 0.5;
  if (label.startsWith(query) || aliases.some((alias) => alias.startsWith(query))) return 1;
  if (label.includes(query) || aliases.some((alias) => alias.includes(query))) return 2;
  if (description.includes(query)) return 3;
  if (descriptionAbbreviations.includes(query)) return 3.5;
  if (category.includes(query)) return 4;
  return 99;
}
