# 设计：grouptype=3 (smart) 地区代理组类型

日期：2026-06-16
状态：已确认，待实现

## 背景

本项目（Mihomo/Substore 覆写规则生成器）当前支持三种地区代理组类型，通过 `grouptype`
参数选择：`0=select`（手动）、`1=url-test`（自动测速）、`2=load-balance`（负载均衡）。

vernesong 的 OpenClash mihomo **smart 内核**新增了 `type: smart` 组类型：基于历史性能
（成功率、延迟、流量、时间衰减、连接类型）+ 可选 LightGBM 模型自动给节点打分选路，历史数据
不足时回退 round-robin。本设计为本项目新增第四种类型 `grouptype=3` (smart)。

> ⚠️ **前提**：`type: smart` 仅 smart 内核能识别，普通 mihomo 内核加载会启动失败。README 需提示此前提。

## 需求

1. 新增 `grouptype=3`，开启后**所有地区组 + 低倍率组**转为 smart 组。
2. 通过参数让**指定地区**不走 smart，并可配置这些地区的回退类型。
3. smart 的关键开关（LightGBM、数据采集、ASN 优先）可通过 URL 参数配置，默认值合理。

## 参数设计

全部参数**仅在 `grouptype=3` 时生效**。

| 参数 | 作用 | 默认 |
|---|---|---|
| `grouptype=3` | 地区组 + 低倍率组转为 smart | — |
| `smartexclude=香港,台湾` | 逗号分隔地区名（对齐 `countriesMeta` 的 key，**不含**`节点`后缀，内部自动补后缀匹配），这些地区不走 smart | 空 |
| `smartfallback=0\|1\|2` | 被排除地区的回退类型，复用 `GroupType` 语义，**禁止 3**（非法或 3 → 回退 0） | `0` (select) |
| `smartlightgbm` | → 组内 `uselightgbm` | `true` |
| `smartcollect` | → 组内 `collectdata` | `false` |
| `smartpreferasn` | → 组内 `prefer-asn` | `false` |

### smart 组输出示例（`grouptype=3` 默认）

```yaml
- name: 香港节点
  type: smart
  uselightgbm: true
  include-all: true
  filter: <香港 pattern>
```

`collectdata` / `prefer-asn` 仅在对应参数为 true 时写入；`uselightgbm` 始终写出（默认 true，
用户可传 `smartlightgbm=false` 关闭，用于无模型内核）。

### 排除 + 回退示例

```
#grouptype=3&smartexclude=香港,台湾&smartfallback=1
```

地区组默认 smart，但「香港节点」「台湾节点」回退为 `url-test`。

## 改动点

### `src/types.ts`
- `GroupType` 扩展为 `0 | 1 | 2 | 3`。
- `ProxyGroupType` 加 `"smart"`。
- 新增 `SmartProxyGroup` 接口：`type: "smart"` + `uselightgbm: boolean` + 可选 `collectdata` /
  `prefer-asn` + 继承 `BaseProxyGroup`；并入 `ProxyGroup` 联合类型。
- `ScriptArgs` 新增 `smartexclude` / `smartfallback` / `smartlightgbm` / `smartcollect` /
  `smartpreferasn`（均 `string`）。
- `FeatureFlags` 新增 `smartExclude: string[]`、`smartFallback: GroupType`、
  `smartLightgbm: boolean`、`smartCollect: boolean`、`smartPreferAsn: boolean`。
- 新增 `SmartOptions` 接口（`uselightgbm` / `collectdata` / `preferAsn`）用于打包透传。
- `BuildCountryProxyGroupsInput` 加 `smartExclude` / `smartFallback` / `smart`；
  `BuildProxyGroupsInput` 加 `smart`。

### `src/args.ts`
- `parseGroupType` 放行返回值 3。
- 新增 `parseSmartFallback(args): GroupType`：解析 `smartfallback`，仅接受 0/1/2，遇 3 或非法 → 0。
- `buildFeatureFlags` 解析 smart 字段：
  - `smartLightgbm = parseBool(args.smartlightgbm, true)`
  - `smartCollect = parseBool(args.smartcollect)`，`smartPreferAsn = parseBool(args.smartpreferasn)`
  - `smartExclude`：按逗号切分、`trim`、过滤空串
  - `smartFallback = parseSmartFallback(args)`

### `src/proxy_groups.ts`
- `buildGroupByType` 增加 `case 3`：输出 smart 组——`uselightgbm` 始终写，`collectdata` /
  `prefer-asn` 仅 true 时写；签名新增 `smart: SmartOptions` 参数。
- `buildCountryProxyGroups`：逐地区计算有效类型——若 `groupType === 3` 且该地区 ∈ `smartExclude`，
  用 `smartFallback`，否则用 `groupType`；再调 `buildGroupByType`。
- 低倍率组：直接用 `groupType`（=3 时跟随 smart，不参与排除）。

### `src/main.ts`
- 解构新 flag，组装 `SmartOptions`，透传给 `buildCountryProxyGroups` / `buildProxyGroups`。
- 顶部 `/*! ... */` banner 补充新参数说明。

### `scripts/yaml_generator/generator.ts`
- `GROUPTYPE_VALUES` 加 `3`。smart 子参数不进组合矩阵（静态 YAML 用默认 smart 配置：`uselightgbm: true`）。

### `README.md`
- `grouptype` 说明加 `3=smart`，新增 smart 参数小节 + smart 内核前提提示。

## 不做（YAGNI）

- 全局模型自动更新字段：`lgbm-auto-update` / `lgbm-update-interval` / `lgbm-url` /
  `profile.smart-collector-size`。
- 组内 `policy-priority`（复杂字符串，URL 参数表达困难）、`sample-rate`（仅配合 collectdata）。

## 验证

- `npm run typecheck` 通过。
- `npm run artifacts`（build + generate）成功，产物体积合理。
- 抽查生成的 `config_gt-3_*.yaml`：地区组为 `type: smart` 且 `uselightgbm: true`。
- 手动构造带 `smartexclude` / `smartfallback` 的参数，确认排除地区回退类型正确（JS 动态覆写路径）。
