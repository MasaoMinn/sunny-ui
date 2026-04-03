# sunny

一个可发布到 npm 的组件分发仓库，支持通过 `pnpm dlx sunny add ...` 直接把组件代码拷贝到目标项目。

## 目标能力

- `pnpm dlx sunny add <组件名>`  
  安装默认路由组件（无额外依赖）
- `pnpm dlx sunny add matter/<组件名>`  
  安装 `matter` 路由组件（先提示所需依赖，用户确认后再安装，如 `matter-js`）

## 目录结构

```txt
bin/
  sunny.mjs                 # CLI 入口
registry/
  registry.json             # 组件注册表（路由、依赖、文件映射）
  core/
    button.tsx              # 默认路由组件示例
  matter/
    gravity-box.tsx         # matter 路由组件示例
```

## CLI 用法

```bash
sunny list
sunny add button
sunny add matter/gravity-box
sunny add button matter/gravity-box --yes
```

`--yes` 会跳过交互确认（自动同意安装依赖和覆盖文件）。

## 组件路由规则

- 不带前缀：默认走 `core` 路由
  - 示例：`button`
  - 输出目录：`src/components/sunny`
  - 默认无额外依赖
- 带 `matter/` 前缀：走 `matter` 路由
  - 示例：`matter/gravity-box`
  - 输出目录：`src/components/sunny/matter`
  - 默认依赖：`matter-js`

## 发布流程

1. 登录 npm

```bash
npm login
```

2. 检查包名是否可用（当前配置名为 `sunny`，若冲突请改 `package.json`）

```bash
npm view sunny
```

3. 发布

```bash
pnpm publish --access public
```

发布后即可在任意项目中执行：

```bash
pnpm dlx sunny add button
pnpm dlx sunny add matter/gravity-box
```
