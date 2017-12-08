const assert = require('assert');
const promClient = require('prom-client');

const NS_PER_SEC = 1e9;

/**
 * Convert hrtime to seconds
 *
 * @private
 * @function hrtimeToSeconds
 * @param {Array} hrtime - hrtime [0, 100]
 * @returns {Number} seconds
 */
function hrtimeToSeconds(hrtime) {
  const diffInNanoSecond = hrtime[0] * NS_PER_SEC + hrtime[1];
  const diffInSeconds = diffInNanoSecond / NS_PER_SEC;

  return diffInSeconds;
}

/**
 * Knex exporter
 *
 * @public
 * @function knexExporter
 * @param {Knex} knex - knex instance
 * @param {Object} [opts] - options
 * @param {String} [opts.queryDurarionName="query_duration_seconds"]
 *  - query duration metric name (histogram)
 * @param {Number[]} [opts.responseTimeBuckets=[0.003, 0.03, 0.1, 0.3, 1.5, 10]]
 *  -  query duration buckets
 * @param {String} [opts.queryErrorName="query_errors_total"]
 *  - query errorr total name (counter)
 * @param {Boolean} [opts.queryErrorWithErrorLabel=true]
 *  - collect err.message as "error" label
 * @returns {Object} { off, registry }
 *  - off: unscribe from metrics, registry: prom-client registry
 * @example
 * const Knex = require('knex');
 * const knexExporter = require('knex-prometheus-exporter');
 *
 * const knex = Knex({
 *  client: 'mysql'
 *  ...
 * });
 * const exporter = knexExporter(knex);
 *
 * console.log(exporter.registry.metrics())
 * // =>
 * // # HELP query_duration_seconds histogram of query responses
 * // # TYPE query_duration_seconds histogram
 * // query_duration_seconds_bucket{le="0.003"} 1
 * // query_duration_seconds_bucket{le="0.03"} 2
 * // query_duration_seconds_bucket{le="0.1"} 2
 * // query_duration_seconds_bucket{le="0.3"} 2
 * // query_duration_seconds_bucket{le="1.5"} 2
 * // query_duration_seconds_bucket{le="10"} 2
 * // query_duration_seconds_bucket{le="+Inf"} 2
 * // query_duration_seconds_sum 0.021
 * // query_duration_seconds_count 2

 * // # HELP query_errors_total counter of query errors with labels: error
 * // # TYPE query_errors_total counter
 * // query_errors_total 0
 * // query_errors_total{error="error message"} 1
 *
 * // Unsubscribe:
 * exporter.off();
 */
function knexExporter(
  knex,
  {
    // Query duration
    queryDurarionName = 'query_duration_seconds',
    queryDurarionNameBuckets = [0.003, 0.03, 0.1, 0.3, 1.5, 10],
    // Query error
    queryErrorName = 'query_errors_total',
    queryErrorWithErrorLabel = true
  } = {}
) {
  assert(knex, 'knex instance is required');

  const queryErrorLabels = [];
  let queryErrorHelp = 'counter of query errors';

  if (queryErrorWithErrorLabel) {
    queryErrorLabels.push('error');
    queryErrorHelp += ` with labels: ${queryErrorLabels.join(', ')}`;
  }

  const queries = new Map();
  const registry = new promClient.Registry();
  const queryDurarionMetric = new promClient.Histogram({
    name: queryDurarionName,
    help: 'histogram of query responses',
    buckets: queryDurarionNameBuckets,
    registers: []
  });
  const queryErrorMetric = new promClient.Counter({
    name: queryErrorName,
    help: queryErrorHelp,
    buckets: queryDurarionNameBuckets,
    labels: queryErrorLabels,
    registers: []
  });

  registry.registerMetric(queryDurarionMetric);
  registry.registerMetric(queryErrorMetric);

  function onQuery(query) {
    queries.set(query.__knexQueryUid, {
      startTime: process.hrtime()
    });
  }

  function onQueryResponse(response, query) {
    const { startTime } = queries.get(query.__knexQueryUid);
    queries.delete(query.__knexQueryUid);

    const diffInHrtime = process.hrtime(startTime);
    const diffInSeconds = hrtimeToSeconds(diffInHrtime);

    queryDurarionMetric.observe(diffInSeconds);
  }

  function onQueryError(error, query) {
    queries.delete(query.__knexQueryUid);
    queryErrorMetric.inc(
      queryErrorWithErrorLabel ? { error: error.message } : undefined
    );
  }

  function off() {
    knex.removeListener('query', onQuery);
    knex.removeListener('query-response', onQueryResponse);
    knex.removeListener('query-error', onQueryError);
  }

  knex.on('query', onQuery);
  knex.on('query-response', onQueryResponse);
  knex.on('query-error', onQueryError);

  return {
    off,
    registry
  };
}

module.exports = knexExporter;