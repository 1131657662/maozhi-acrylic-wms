# B6g 验收记录

日期：2026-11-13
分支：`codex/b6g-persisted-search-text`
起点：`3ae28f8`
范围：商品、客户、供应商、车辆持久化 `search_text`；022 迁移；统一生成与写入同步；NULL 幂等回填；`q` 与旧 `keyword` 兼容。

## 数据与迁移

- 依赖固定为 `pinyin-pro@3.29.5`，许可证为 MIT，许可证文本随 npm 包提供。
- `search_text` 为四表 nullable `VARCHAR(512)` 和非唯一普通索引。全拼和首字母采用 pinyin-pro 默认多音字规则；小写化并去空白/Unicode 标点；超过 512 个 Unicode 字符拒绝写入，不截断。
- down 在执行 DDL 前检查四表，任一值非 NULL（包括空串）即拒绝；专项测试验证拒绝后列仍存在。
- `maozhi_dev_sample` 首次回填：商品 569 行、客户 377 行、供应商 2 行、车辆 4 行。再次运行 `npm run backfill:search-text -w @wms/api`：四表均为 0 行。迁移前后业务字段指纹一致；只写入新检索列。

## EXPLAIN 与耗时

环境为本机隔离的 MySQL 8 `maozhi_dev_sample`，身份 `maozhi-local-mysql8-v1`。当前列表范围为启用商品库存候选 428 行、启用客户 377 行。EXPLAIN 查询结构如下，`%jl%` 为代表性关键词：

```sql
EXPLAIN SELECT * FROM master_products
WHERE source_del_flag=0 AND source_kind<>'sku-spec' AND inventory_eligible=1 AND active=1
  AND (search_text LIKE '%jl%' OR code LIKE '%jl%' OR name LIKE '%jl%')
ORDER BY code LIMIT 20;

EXPLAIN SELECT * FROM master_customers
WHERE source_del_flag=0 AND active=1
  AND (search_text LIKE '%jl%' OR code LIKE '%jl%' OR name LIKE '%jl%')
ORDER BY code LIMIT 20;
```

执行计划（MySQL 8 `EXPLAIN`）：

| 表               | type  | possible_keys            | key                      | key_len | rows | filtered | Extra                              |
| ---------------- | ----- | ------------------------ | ------------------------ | ------: | ---: | -------: | ---------------------------------- |
| master_products  | range | product_inventory_lookup | product_inventory_lookup |       3 |  428 |    26.79 | Using index condition; Using where |
| master_customers | index | NULL                     | PRIMARY                  |     322 |   20 |     0.30 | Using where                        |

完整原始字段：

```json
{
  "products": [
    {
      "id": "1",
      "select_type": "SIMPLE",
      "table": "master_products",
      "partitions": null,
      "type": "range",
      "possible_keys": "product_inventory_lookup",
      "key": "product_inventory_lookup",
      "key_len": "3",
      "ref": null,
      "rows": "428",
      "filtered": 26.79,
      "Extra": "Using index condition; Using where"
    }
  ],
  "customers": [
    {
      "id": "1",
      "select_type": "SIMPLE",
      "table": "master_customers",
      "partitions": null,
      "type": "index",
      "possible_keys": null,
      "key": "PRIMARY",
      "key_len": "322",
      "ref": null,
      "rows": "20",
      "filtered": 0.3,
      "Extra": "Using where"
    }
  ]
}
```

两条计划都未选择 `search_text` B-tree。商品使用库存资格索引，客户按主键（编码顺序）扫描并过滤。`LIKE '%q%'` 的前置通配不能用 B-tree 做范围定位；有该普通索引不代表本查询可以使用它。

每类串行调用完整 `listMasterItems` 服务 10 次，每个关键词不同；计时包含总数查询、分页、投影，不含 HTTP 网络、认证及浏览器耗时。p95 使用 nearest-rank，10 个样本下等于最大值：

| 商品关键词 |        ms | 客户关键词 |        ms |
| ---------- | --------: | ---------- | --------: |
| jl         |     6.878 | nbzx       |     3.381 |
| jinglun    |     3.132 | ningbo     |     2.098 |
| 腈纶       |     3.510 | 浙江       |     2.419 |
| acrylic    |     3.654 | 客户       |     2.447 |
| 032        |     3.912 | DEMO       |     1.761 |
| model      |     2.564 | cust       |     1.766 |
| duanxian   |     2.310 | C000       |     2.605 |
| shortfiber |     2.610 | xian       |     1.767 |
| P000       |     2.456 | zhongxian  |     2.188 |
| fiber      |     2.996 | customer   |     1.820 |
| **p95**    | **6.878** | **p95**    | **3.381** |

两类当前本机样本均低于 150ms，可接受于这次测得的数据规模；这不外推到更大数据量、其他硬件、网络或生产环境。若后续实测超过 150ms，再提出并评估查询方案，不自动增加分页缓存。

## 验证状态

- 主数据测试覆盖拼音全拼、首字母、型号、旧编码、停用候选过滤、无库存资格商品排除、旧 `keyword` 行为、回填幂等、修改同步和非空 down 保护。
- `npm run test`：**406/406** 通过。
- `npm run build`：exit 0；API/Web TypeScript 检查及 Web 构建通过。构建输出有既有 `caniuse-lite` 过期提示。
- `npm run test:e2e`：主套件首轮 129/131；审计筛选用例因运行时 30 秒超时，单独复跑所属 spec 后 2/2 通过。列表拖拽长任务用例记录 59ms，单独复跑记录 62ms，超过该既有测试的 50ms 门槛；未修改或放宽该测试。主套件因此返回 exit 1，目录专项没有由 `&&` 自动启动。
- 单独运行目录专项：11/11 通过。没有实体设备或生产环境验收。

状态区分：代码完成；本机构建通过；API 自动化与目录专项通过，完整主 E2E 有一项既有 50ms 长任务门槛失败；实体设备及生产验收未进行。
