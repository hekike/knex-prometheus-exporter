# knex-prometheus-exporter

Prometheus exporter for [knex](https://www.npmjs.com/package/knex)

```sh
npm i -S knex-prometheus-exporter prom-client
```

### Table of Contents

-   [knexExporter](#knexexporter)

### knexExporter

Knex exporter

**Parameters**

-   `knex` **Knex** knex instance
-   `opts` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)?** options
    -   `opts.queryDurarionName` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** query duration metric name (histogram) (optional, default `"query_duration_seconds"`)
    -   `opts.responseTimeBuckets` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[Number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)>**  query duration buckets (optional, default `[0.003,0.03,0.1,0.3,1.5,10]`)
    -   `opts.queryErrorName` **[String](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** query errorr total name (counter) (optional, default `"query_errors_total"`)
    -   `opts.queryErrorWithErrorLabel` **[Boolean](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Boolean)** collect err.message as "error" label (optional, default `true`)

**Examples**

```javascript
const Knex = require('knex');
const knexExporter = require('knex-prometheus-exporter');

const knex = Knex({
 client: 'mysql'
 ...
});
const exporter = knexExporter(knex);

console.log(exporter.registry.metrics())
// =>
// # HELP query_duration_seconds histogram of query responses
// # TYPE query_duration_seconds histogram
// query_duration_seconds_bucket{le="0.003"} 1
// query_duration_seconds_bucket{le="0.03"} 2
// query_duration_seconds_bucket{le="0.1"} 2
// query_duration_seconds_bucket{le="0.3"} 2
// query_duration_seconds_bucket{le="1.5"} 2
// query_duration_seconds_bucket{le="10"} 2
// query_duration_seconds_bucket{le="+Inf"} 2
// query_duration_seconds_sum 0.021
// query_duration_seconds_count 2

// # HELP query_errors_total counter of query errors with labels: error
// # TYPE query_errors_total counter
// query_errors_total 0
// query_errors_total{error="error message"} 1

// Unsubscribe:
exporter.off();
```

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** { off, registry }-   off: unscribe from metrics, registry: prom-client registry
