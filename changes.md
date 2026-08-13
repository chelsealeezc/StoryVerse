# StoryVerse 变更说明

**分支** `backend-api-2.3-2.4` · **基于** `main` (`677f3c8`) · **17 个文件，+1514 / −277**

对应《0809 后端接入上线需求》的 **2.3 画风修改** 与 **2.4 API 接入**。main 分支未做任何改动。

> **2.6 相似度关联（语义向量分析）本次不做**，按讨论结论跳过。

---

## 一、本次做了什么

| 需求 | 状态 | 说明 |
|---|---|---|
| 2.3 画风修改 ×2 | **完成** | 改名 + 换示意图，生图 prompt 未动 |
| 2.4 语音转文字 | **完成** | 填 API Key 即可运行 |
| 2.4 内容审核 | **前端完成** | 服务端接入待办，见第五节 |
| 2.4 翻译 | 不做 | 本次不实现 |
| 2.4 语义向量分析 | 不做 | 即 2.6 |
| 附带 | — | 英文模式漏译、排版与若干交互 bug |

---

## 二、2.3 画风修改

### 改了什么

| id（不变） | 原名 | 现名 | 英文名 |
|---|---|---|---|
| `crayon` | 3D 黏土动画风 | **卡通蜡笔风** | Cartoon clay |
| `minimal-realistic` | 简约写实风 | **日本画风** | Japanese poster |
| `zine` | 独立杂志风 | 不变 | Indie zine |
| `retro-collage` | 复古拼贴风 | 不变 | Retro collage |

**风格 id 一律没变**，后端那张 prompt 表不需要跟着改。

### 示意图

`src/assets/image-styles/crayon.jpg`、`minimal-realistic.jpg` 换成了新提供的参考图。

两张原图都是「上=原照片 / 下=风格化结果」的对比图，这里**只保留了下半张结果**，中心裁成正方形缩到 640×640。原因：StoryVerse 是从文字生图，用户不会上传照片，留着上半张会让人误以为要先传一张照片。

另外补了 `zine.svg` —— 独立杂志风此前借用简约写实的图，现在有自己的示意图（半调网点 + 双色套印 + 大留白）。

### prompt 未改动

`server/image-generation.ts` 里两条 prompt 本来就与新示意图一致：

- `crayon` = 阿德曼动画风格的荒诞黏土定格世界
- `minimal-realistic` = 极简丝网印刷海报，大块几何剪影，4–6 种实色油墨，大面积留白

**原来的问题只是名字和示意图错位，不是 prompt 错**，所以一行未动。四种风格补齐了 `labelEn` / `descriptionEn`。

---

## 三、2.4 语音转文字

对接豆包（火山引擎）大模型语音识别，资源 `volc.bigasr.auc_turbo`。

### 新增文件

**`server/speech-to-text.ts`**（179 行）
识别服务。**API Key 只存在于服务端环境变量**，与 `image-generation.ts` 同构，绝不进前端产物。

- 音频上限 8MB，请求超时 30 秒
- 兼容两种返回结构（`result.text` 与 `result.utterances[]`），换资源包不会整条链路失效
- 九种错误分别映射为对用户可读的中文提示（未配置 Key / 鉴权失败 / 限流 / 超时 / 没听清 / 连不上…）

**`src/speech.ts`**（136 行）
浏览器录音。用 `MediaRecorder`，**没有用浏览器自带的 `SpeechRecognition`** —— Chrome 的实现会把音频发到 Google，境内不可用，且 Safari/Firefox 行为不一致。

- 自动挑选浏览器支持的录音格式（webm/opus → ogg → m4a）
- 单段录音上限 60 秒，到点自动停止
- 录完显式释放麦克风轨道，否则标签页的录音指示灯会一直亮着
- 离开该页面时自动取消录音

### 改动文件

**`server/app.ts`**（+27 行）
注册 `POST /api/transcribe`。需登录，限流 40 次/小时（比生图的 6 次/小时宽松，因为写一篇故事可能分几段录）。

**`src/App.tsx`**
麦克风按钮从占位按钮改为可用，三种状态：`语音输入` → `结束录音` → `正在转文字…`。

识别结果**追加到正文末尾，不覆盖已有内容** —— 用户通常是写一段再补一段口述。

### 需要配置的环境变量

```bash
VOLC_ASR_ACCESS_KEY=你的密钥      # 必填
VOLC_ASR_APP_KEY=你的APPID        # 建议填，鉴权失败时必填
VOLC_ASR_RESOURCE_ID=...          # 可选，默认 volc.bigasr.auc_turbo
VOLC_ASR_BASE_URL=...             # 可选，默认官方 flash 接口
```

需求文档写的是「Header 使用 `X-Api-Key`」，但火山 v3 接口实际读三个头。代码里 `X-Api-Key` 和 `X-Api-Access-Key` **两个都带上**，哪种命名生效都不影响，省得为一个头名反复联调。

**未配置 Key 时**：按钮可点，但会返回「尚未配置语音识别 API Key」，不影响其它功能。

---

## 四、2.4 内容审核（前端部分）

`src/moderation.ts` 按《人生故事网站内容审核准则（柔性提示版）》重写（+507 行）。

### 分级与分类

三级 `L1` / `L2` / `L3`，八个类别：隐私泄露、攻击辱骂、危险创伤、**危机**、仇恨歧视、涉未成年人、露骨性内容、广告垃圾。

升级规则按准则实现：隐私涉第三方或未成年人 L1→L2；攻击构成人肉搜索 L1→L3；危险内容按 **危机 > 具体方法(L3) > 回顾性叙述(L2)** 分流；仇恨系统性 L1→L3；涉未成年人**始终 L3 无例外**。

**危机信号走独立通道**，不套用常规审核文案，按准则第三节给出关怀性提示。

### 三个已修复的漏判

**① 标题不参与审核**
原来只检查正文，标题写「die」直接漏过。现在标题也进审核。

**② 标题与正文只报一处**
危机 / 具体方法 / 回顾叙述三个分支互斥，只报等级最高的那个。标题写 `die`（L2）、正文写 `jump off a building`（L3），L3 赢了就把标题那条吃掉，用户改完正文以为标题没问题。现在**两处都会报出来，并标明出现在标题还是正文**（`in the title` / `in the story` / `in both`）。

**③ 打错字就整条漏掉**
词表里没有英文的 `kill myself` / `jump off a building`（只有中文「跳楼」）；而且 `killmyself` 与用户实际输入的 `killmyslef` 差一次字母调换，精确匹配收不到。

现在补齐了英文自伤与方法表述，并加了 **Damerau-Levenshtein 容错匹配**（比普通编辑距离多认「相邻字符调换」，正好是这类手误）：

- 只对**长的高信号短语**做容错。短词（`die`、`死`）不做 —— 会把 `did` / `dye` / `diet` 全扫进来
- 短语 14 字以内容 1 个错，更长的容 2 个
- 方法类（L3）与回顾叙述类（L2）分开做，打错字的方法描述不会掉级
- 匹配前压掉所有空白，`killmyself` / `kill  myself` / 跨行写法都能收到

### 回归测试

`tests/moderation.test.ts` —— **32 条用例，两组各 16 条**，卡住漏判与误判两头。

**必须拦**：标题孤词、拼错的自伤短语、中文自伤与危机表达、人身攻击、手机号、微信广告，以及「两处都要报」「同词合并标 both」「危机走独立通道」。

**必须放行**（都是容易误伤的真实故事）：

`奶奶去世了` · `The day my grandmother died` · `Dead End Road` · `Kill the lights` · `My skill set` · `死磕到底` · `轻舟已过万重山` · `A quiet promotion` · `搬家那天` 等 16 篇。

其中 `Kill the lights` 与 `My skill set` 是专门用来卡容错匹配的 —— 后者 `skill set … Myself` 连起来非常接近 `kill myself`，两条都正常放行。

性能：1500 字故事 **11ms**。

### 一个刻意的设计取舍

**正文里单独出现的 `die` 不拦。** 「我外婆去世了」「I thought I would die」这类正当写法太多，拦它会大面积误伤。**标题里孤零零一个 `die` 是拦的** —— 一个单词的标题没有上下文可以消歧，要么是测试输入，要么是求助信号。

---

## 五、待办：服务端审核尚未接入

`src/moderation.ts` **跑在浏览器里**，是本地启发式规则。

`server/app.ts` 的 `POST /api/v1/stories/publish` **目前没有任何内容审核**，只检查正文长度 ≥ 30 字。绕开前端直接调这个接口，任何内容都能发布。

需求文档给的 `moderation_prompt.txt.md` 是要喂给大模型的 prompt，服务端那一层（qwen）尚未接入。上线前需要补上。

接入时**只要保持 `ModerationResult` 的结构不变，前端界面完全不用改**。

另外 `server/app.ts:74` 的 `deterministicAnalysis` 仍是关键词匹配（`body.includes("父亲") ? "家庭" : …`），故事里没有这几个词就一律归到「成长」。2.5 的 prompt 已写好但未接进代码。

---

## 六、附带修复的界面问题

### 英文模式下的中文残留

英文模式下多处仍显示中文。修复涉及：

- 时间 / 人生阶段 / 人物三组选项 —— **value 固定存中文**（进数据库、也是研究口径），只翻译显示层，切语言不会丢已选值
- 主题标签新增 `themeLabelsEn` 显示映射（家庭→Family、迁移→Migration…），同样只翻译显示层
- 星图 12 个演示星点补 `labelEn` / `descEn`；写死的 5 个中文标签改为故事自己的主题/城市/阶段
- 「还差一点」的五个缺项 —— 现在直接引用表单上那一栏的标题本身，提示里出现什么字，页面上就有一栏叫什么字
- 发布按钮、生图与发布的兜底错误、推荐页与推荐卡、故事详情卡的配图状态

`StoryDetail` 原本没有接收 `language`，已补上该 prop。

### 文案

- `Follow the thought, slowly.` → `Start anywhere.` + `Take your time.`（与中文「顺着想法，慢慢写。」一样是两段式）
- `愧疚` 的英文由 `Shame` 改为 `Guilty`（量表口径上 guilt 与 shame 是两个不同构念）
- 共鸣维度 `Near` → `Similar`（此处指「与你相似」，不是「距离近」）
- 第四步「地点」英文由 `Place` 改为 `City`，与第二步一致
- `选填` 拆成两个键：下拉用 `please select`，输入框用 `please fill in`

### 排版与尺寸

- **引导卡文字被裁**：`.guide-panels` 高度 `min(430px,46vh)` 在 720p 上只有 331px，而英文标题换行后内容需要 335px，外层 `overflow:hidden` 把底部切掉。改为 `clamp(384px,46vh,430px)`，标题字号收一档
- **引导卡图标与标题间距不一致**：`justify-content:space-between` 让间距随标题长度变化。改为固定 `gap:16px`，序号用 `margin-left:auto` 推到右侧。七张卡实测间距一致
- **星点卡需要缩放才看得全**：`.story-panel` 是 `fixed` 居中但没有高度上限、也没有滚动容器。加 `max-height: calc(100vh - 40px)` + `overflow-y:auto`。720px 高时卡片 615px 完整在屏内；560px 高时封顶 518px 仍完整在屏内
- **星点卡关闭按钮过大**：64×64、图标 26px → 38×38、图标 16px
- **点星星贴太近**：机位距离约 2.5 个单位且 fov 从 53 收到 34，两个放大效果叠加。改为距离约 4.9、fov 收到 46
- **第二步蓝色面板标题重复**：`Pill` 与 `.panel-detail > small` 各渲染了一次，删掉后者；字号 26px → `clamp(19px,1.55vw,23px)`；`.panel-detail` 原有 `max-height:340px` 会切掉例子，已放开

### 交互 bug

- **第四步标题改不动**：输入框 `value` 是 `draft.title || suggestedTitle`，删空后立刻弹回建议标题。改为进第四步时把建议标题真正写进 `draft.title`，建议标题降级为 placeholder
- **标签面板到上限不自动收起**：打开它的按钮在满 2 个后是 disabled 的，面板却还开着，里面每个选项都点不动。现到上限自动收起，自定义主题添加成功后也收起
- **自定义主题在英文模式下无法添加**：校验写的是 `Array.from(value).length > 2`（中文「最多 2 个字」的规矩），英文下任何超过两个字母的词都会被拒。改为按文字类型判断——中文仍最多 2 字，拉丁字母放到 16 字符
- **「添加」按钮看不见文字**：`.button-ghost` 是浅色底且未设 `color`，在深色弹层里继承成白色 → 白底白字。已给出配套配色
- **第三步白屏**：该页需要 `state.analysis`（来自后端），补了空状态与「回到第一步」

---

## 七、验证

| 项目 | 结果 |
|---|---|
| `npx tsc -b` | 通过，无错误 |
| `npm test` | **44 / 44 通过**（含新增 32 条审核用例） |
| `npm run build` | 通过 |

**验证边界**：第三步与第四步需要 `state.analysis`（来自后端），本地 `/api/v1/auth/me` 返回 500（未配置 Key、无数据库），因此第四步标题、标签面板等**仅做了类型检查与代码验证，未能在浏览器中点验**。星图为 WebGL，预览环境中 canvas 退化为 300×150，机位数值按几何计算得出。**建议后端跑起来后实际点一遍。**

---

## 八、文件清单

### 新增

| 文件 | 行数 | 说明 |
|---|---|---|
| `server/speech-to-text.ts` | 179 | 豆包语音识别服务 |
| `src/speech.ts` | 136 | 浏览器录音与调用 |
| `tests/moderation.test.ts` | 95 | 审核回归测试 32 条 |
| `src/assets/image-styles/zine.svg` | 47 | 独立杂志风示意图 |

### 修改

| 文件 | 变化 | 说明 |
|---|---|---|
| `src/App.tsx` | +532 | 双语、语音按钮、标签面板、标题编辑、审核弹窗 |
| `src/moderation.ts` | +507 | 审核准则实现与容错匹配 |
| `src/StoryGalaxy.tsx` | +52 | 演示数据双语、机位、Similar |
| `src/story-galaxy.css` | +56 | 星点卡高度、关闭按钮 |
| `src/PrototypeGateway.tsx` | +69 | 入口文案双语 |
| `src/styles.css` | +43 | 引导卡、面板、语音按钮 |
| `server/app.ts` | +27 | `/api/transcribe` 路由 |
| `server/image-generation.ts` | +22 | 风格表与 prompt 清理 |
| `tests/image-generation.test.ts` | +19 | 改为按 id 查找，加风格不再位移断言 |
| `src/types.ts` | +5 | `ModerationFlag` 对齐 |
| `src/image.ts` | +2 | `ImageStyle` 增加 zine |
| `crayon.jpg` / `minimal-realistic.jpg` | — | 新示意图 |
