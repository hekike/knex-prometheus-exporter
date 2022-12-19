const path = require('path');
const Knex = require('knex');
const promClient = require('prom-client');
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
let register;

test.beforeEach(async () => {
  register = new promClient.Registry();

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
  exporter = await knexExporter(knex, {
    register,
    queryDurarionNameBuckets: [0.1, 0.3, 1.5, 10] // large enough buckets to avoid spreading
  });

  await knex(tableName).insert({
    name: 'Jane'
  });

  const user = await knex(tableName)
    .select('id', 'name')
    .first();

  const metricsOutput = await register.metrics();
  const [, sum] = metricsOutput.match(
    /knex_query_duration_seconds_sum ([0-9]+.[0-9]+)/
  );
  t.deepEqual(user.name, 'Jane');
  t.true(sum > 0, 'sum is larger than zero');
  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP knex_query_duration_seconds histogram of query responses
      # TYPE knex_query_duration_seconds histogram
      knex_query_duration_seconds_bucket{le="0.1"} 2
      knex_query_duration_seconds_bucket{le="0.3"} 2
      knex_query_duration_seconds_bucket{le="1.5"} 2
      knex_query_duration_seconds_bucket{le="10"} 2
      knex_query_duration_seconds_bucket{le="+Inf"} 2
      knex_query_duration_seconds_sum ${sum}
      knex_query_duration_seconds_count 2

      # HELP knex_query_errors_total counter of query errors with labels: error
      # TYPE knex_query_errors_total counter\n
    `
  );
});

test.serial('counts query errors', async t => {
  t.plan(2);
  exporter = await knexExporter(knex, { register });

  let queryError;

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    queryError = err;
    t.truthy(err);
  }

  const metricsOutput = await register.metrics();

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP knex_query_duration_seconds histogram of query responses
      # TYPE knex_query_duration_seconds histogram
      knex_query_duration_seconds_bucket{le="0.003"} 0
      knex_query_duration_seconds_bucket{le="0.03"} 0
      knex_query_duration_seconds_bucket{le="0.1"} 0
      knex_query_duration_seconds_bucket{le="0.3"} 0
      knex_query_duration_seconds_bucket{le="1.5"} 0
      knex_query_duration_seconds_bucket{le="10"} 0
      knex_query_duration_seconds_bucket{le="+Inf"} 0
      knex_query_duration_seconds_sum 0
      knex_query_duration_seconds_count 0

      # HELP knex_query_errors_total counter of query errors with labels: error
      # TYPE knex_query_errors_total counter
      knex_query_errors_total{error="${queryError.message}"} 1\n
    `
  );
});

test.serial('counts query errors without label', async t => {
  t.plan(2);
  exporter = await knexExporter(knex, {
    register,
    queryErrorWithErrorLabel: false
  });

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    t.truthy(err);
  }

  const metricsOutput = await register.metrics();

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP knex_query_duration_seconds histogram of query responses
      # TYPE knex_query_duration_seconds histogram
      knex_query_duration_seconds_bucket{le="0.003"} 0
      knex_query_duration_seconds_bucket{le="0.03"} 0
      knex_query_duration_seconds_bucket{le="0.1"} 0
      knex_query_duration_seconds_bucket{le="0.3"} 0
      knex_query_duration_seconds_bucket{le="1.5"} 0
      knex_query_duration_seconds_bucket{le="10"} 0
      knex_query_duration_seconds_bucket{le="+Inf"} 0
      knex_query_duration_seconds_sum 0
      knex_query_duration_seconds_count 0

      # HELP knex_query_errors_total counter of query errors
      # TYPE knex_query_errors_total counter
      knex_query_errors_total 1\n
    `
  );
});

test.serial('supports prefix', async t => {
  t.plan(2);
  exporter = await knexExporter(knex, {
    register,
    prefix: 'foo_',
    queryErrorWithErrorLabel: false
  });

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    t.truthy(err);
  }

  const metricsOutput = await register.metrics();

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP foo_query_duration_seconds histogram of query responses
      # TYPE foo_query_duration_seconds histogram
      foo_query_duration_seconds_bucket{le="0.003"} 0
      foo_query_duration_seconds_bucket{le="0.03"} 0
      foo_query_duration_seconds_bucket{le="0.1"} 0
      foo_query_duration_seconds_bucket{le="0.3"} 0
      foo_query_duration_seconds_bucket{le="1.5"} 0
      foo_query_duration_seconds_bucket{le="10"} 0
      foo_query_duration_seconds_bucket{le="+Inf"} 0
      foo_query_duration_seconds_sum 0
      foo_query_duration_seconds_count 0

      # HELP foo_query_errors_total counter of query errors
      # TYPE foo_query_errors_total counter
      foo_query_errors_total 1\n
    `
  );
});

test.serial('supports labels', async t => {
  t.plan(2);
  exporter = await knexExporter(knex, {
    register,
    labels: { foo: 'bar' },
    queryErrorWithErrorLabel: false,
    queryDurarionNameBuckets: [0.1, 0.3, 1.5, 10] // large enough buckets to avoid spreading
  });

  try {
    await knex(tableName).insert({
      invalid_field: 'Jane'
    });
  } catch (err) {
    t.truthy(err);
  }

  await knex(tableName)
    .select('id', 'name')
    .first();

  const metricsOutput = await register.metrics();
  const [, sum] = metricsOutput.match(
    /knex_query_duration_seconds_sum{foo="bar"} ([0-9]+.[0-9]+)/
  );

  t.deepEqual(
    metricsOutput,
    dedent`
      # HELP knex_query_duration_seconds histogram of query responses
      # TYPE knex_query_duration_seconds histogram
      knex_query_duration_seconds_bucket{le="0.1",foo="bar"} 1
      knex_query_duration_seconds_bucket{le="0.3",foo="bar"} 1
      knex_query_duration_seconds_bucket{le="1.5",foo="bar"} 1
      knex_query_duration_seconds_bucket{le="10",foo="bar"} 1
      knex_query_duration_seconds_bucket{le="+Inf",foo="bar"} 1
      knex_query_duration_seconds_sum{foo="bar"} ${sum}
      knex_query_duration_seconds_count{foo="bar"} 1

      # HELP knex_query_errors_total counter of query errors
      # TYPE knex_query_errors_total counter
      knex_query_errors_total{foo="bar"} 1\n
    `
  );
});
