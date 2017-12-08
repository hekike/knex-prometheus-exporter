const path = require('path');
const Knex = require('knex');
const test = require('ava');
const dedent = require('dedent');
const knexExporter = require('../lib');

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, './mydb.sqlite')
  }
});
const tableName = 'users';
let exporter;

test.beforeEach(async () => {
  await knex.schema.createTableIfNotExists(tableName, table => {
    table.increments();
    table.string('name').notNullable();
  });
});
test.afterEach.always(async () => {
  await knex(tableName).delete();
  exporter.off();
});

test.serial('measures query', async t => {
  exporter = knexExporter(knex, {
    queryDurarionNameBuckets: [0.1, 0.3, 1.5, 10] // large enough buckets to avoid spreading
  });

  await knex(tableName).insert({
    name: 'Jane'
  });

  const user = await knex(tableName)
    .select('id', 'name')
    .first();

  const metricsOutput = exporter.registry.metrics();
  const [, sum] = metricsOutput.match(
    /query_duration_seconds_sum ([0-9]+.[0-9]+)/
  );

  t.deepEqual(user.name, 'Jane');
  t.true(sum > 0, 'sum is larger than zero');
  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP query_duration_seconds histogram of query responses
      # TYPE query_duration_seconds histogram
      query_duration_seconds_bucket{le="0.1"} 2
      query_duration_seconds_bucket{le="0.3"} 2
      query_duration_seconds_bucket{le="1.5"} 2
      query_duration_seconds_bucket{le="10"} 2
      query_duration_seconds_bucket{le="+Inf"} 2
      query_duration_seconds_sum ${sum}
      query_duration_seconds_count 2

      # HELP query_errors_total counter of query errors with labels: error
      # TYPE query_errors_total counter
      query_errors_total 0\n
    `
  );
});

test.serial('counts query errors', async t => {
  t.plan(2);
  exporter = knexExporter(knex);

  let queryError;

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    queryError = err;
    t.truthy(err);
  }

  const metricsOutput = exporter.registry.metrics();

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP query_duration_seconds histogram of query responses
      # TYPE query_duration_seconds histogram
      query_duration_seconds_bucket{le="0.003"} 0
      query_duration_seconds_bucket{le="0.03"} 0
      query_duration_seconds_bucket{le="0.1"} 0
      query_duration_seconds_bucket{le="0.3"} 0
      query_duration_seconds_bucket{le="1.5"} 0
      query_duration_seconds_bucket{le="10"} 0
      query_duration_seconds_bucket{le="+Inf"} 0
      query_duration_seconds_sum 0
      query_duration_seconds_count 0

      # HELP query_errors_total counter of query errors with labels: error
      # TYPE query_errors_total counter
      query_errors_total 0
      query_errors_total{error="${queryError.message}"} 1\n
    `
  );
});

test.serial('counts query errors without label', async t => {
  t.plan(2);
  exporter = knexExporter(knex, {
    queryErrorWithErrorLabel: false
  });

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    t.truthy(err);
  }

  const metricsOutput = exporter.registry.metrics();

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP query_duration_seconds histogram of query responses
      # TYPE query_duration_seconds histogram
      query_duration_seconds_bucket{le="0.003"} 0
      query_duration_seconds_bucket{le="0.03"} 0
      query_duration_seconds_bucket{le="0.1"} 0
      query_duration_seconds_bucket{le="0.3"} 0
      query_duration_seconds_bucket{le="1.5"} 0
      query_duration_seconds_bucket{le="10"} 0
      query_duration_seconds_bucket{le="+Inf"} 0
      query_duration_seconds_sum 0
      query_duration_seconds_count 0

      # HELP query_errors_total counter of query errors
      # TYPE query_errors_total counter
      query_errors_total 1\n
    `
  );
});
