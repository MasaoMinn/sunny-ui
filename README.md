# sunny-zy

## 项目用途

`sunny-zy` 是一个组件分发 CLI。  
用户通过 `pnpm dlx sunny-zy add ...` 直接把组件源码下载到本地项目，而不是把组件包加入依赖。

## 组件用途

当前发布组件：`matter/bubble-box`。  
该组件基于 `matter-js` 渲染可碰撞、可配置样式/形状/旋转/缩放的泡泡盒子。

下载后文件路径为：

`/components/ui/matter/BubbleBox.tsx`

## 下载方式

```bash
pnpm dlx sunny-zy add matter/bubble-box
```

执行时会先提示所需依赖（如 `matter-js`），用户确认后自动安装。
