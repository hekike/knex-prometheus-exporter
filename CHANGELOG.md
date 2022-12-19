<a name="3.0.0"></a>
## 3.0.0 (2022-12-19)

#### Breaking according the prom-client 13.x

changed: The following functions are now async (return a promise):
registry.metrics()
registry.getMetricsAsJSON()
registry.getMetricsAsArray()
registry.getSingleMetricAsString()


<a name="2.1.0"></a>
## 2.1.0 (2017-12-09)


#### Features

* **exporter:** support labels ([7de8ed68](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/7de8ed68))


<a name="2.0.0"></a>
## 2.0.0 (2017-12-08)


#### Features

* **knex:** register support and prefix ([5a5af15b](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/5a5af15b))


#### Breaking Changes

* external registry

 ([5a5af15b](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/5a5af15b))


<a name="1.0.1"></a>
### 1.0.1 (2017-12-08)


#### Bug Fixes

* **knex:** prefix metrics with knex_ ([588b7f4d](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/588b7f4d))


<a name="1.0.0"></a>
## 1.0.0 (2017-12-08)


#### Bug Fixes

* **exporter:** move prom-client to peer dependency ([31d97c21](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/31d97c21))


#### Features

* **exporter:** implement ([150da51d](git+https://github.com/hekike/knex-prometheus-exporter.git/commit/150da51d))

