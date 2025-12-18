const appLog = require("debug")("app");
const dbLog = require("debug")("db");
const queriesLog = require("debug")("queries");

const Connection = require("tedious").Connection;
const Request = require("tedious").Request;
const app = require("express")();
const client = require("prom-client");

const { entries } = require("./metrics");

// Try to load package.json from different possible locations
let version = "unknown";
try {
  version = require("../package.json").version;
} catch (e) {
  try {
    // In Docker, package.json is copied to the same directory as index.js
    version = require("./package.json").version;
  } catch (e2) {
    console.warn("Could not load version from package.json");
  }
}

let config = {
  connect: {
    server: process.env["SERVER"],
    authentication: {
      type: "default",
      options: {
        userName: process.env["USERNAME"],
        password: process.env["PASSWORD"],
      },
    },
    options: {
      port: parseInt(process.env["PORT"]) || 1433,
      encrypt: process.env["ENCRYPT"] !== undefined ? process.env["ENCRYPT"] === "true" : true,
      trustServerCertificate: process.env["TRUST_SERVER_CERTIFICATE"] !== undefined ? process.env["TRUST_SERVER_CERTIFICATE"] === "true" : true,
      rowCollectionOnRequestCompletion: true,
    },
  },
  port: parseInt(process.env["EXPOSE"]) || 4000,
};

if (!config.connect.server) {
  throw new Error("Missing SERVER information");
}
if (!config.connect.authentication.options.userName) {
  throw new Error("Missing USERNAME information");
}
if (!config.connect.authentication.options.password) {
  throw new Error("Missing PASSWORD information");
}

/**
 * Connects to a database server.
 *
 * @returns Promise<Connection>
 */
async function connect() {
  return new Promise((resolve, reject) => {
    dbLog(
      "Connecting to",
      config.connect.authentication.options.userName + "@" + config.connect.server + ":" + config.connect.options.port,
      "encrypt:",
      config.connect.options.encrypt,
      "trustServerCertificate:",
      config.connect.options.trustServerCertificate
    );

    let connection = new Connection(config.connect);
    connection.on("connect", (error) => {
      if (error) {
        console.error("Failed to connect to database:", error.message || error);
        reject(error);
      } else {
        dbLog("Connected to database");
        resolve(connection);
      }
    });
    connection.on("error", (error) => {
      console.error("Error while connected to database:", error.message || error);
      reject(error);
    });
    connection.on("end", () => {
      dbLog("Connection to database ended");
    });
    connection.connect();
  });
}

/**
 * Recursive function that executes all collectors sequentially
 *
 * @param connection database connection
 * @param collector single metric: {query: string, collect: function(rows, metric)}
 * @param name name of collector variable
 *
 * @returns Promise of collect operation (no value returned)
 */
async function measure(connection, collector, name) {
  return new Promise((resolve) => {
    queriesLog(`Executing metric ${name} query: ${collector.query}`);
    let request = new Request(collector.query, (error, rowCount, rows) => {
      if (!error) {
        queriesLog(`Retrieved metric ${name} rows (${rows.length}): ${JSON.stringify(rows, null, 2)}`);

        if (rows.length > 0) {
          try {
            collector.collect(rows, collector.metrics);
          } catch (error) {
            console.error(`Error processing metric ${name}:`, error.message || error);
          }
        }
        resolve();
      } else {
        console.error(`Error executing query for metric ${name}:`, error.message || error);
        resolve();
      }
    });
    connection.execSql(request);
  });
}

/**
 * Function that collects from an active server.
 *
 * @param connection database connection
 *
 * @returns Promise of execution (no value returned)
 */
async function collect(connection) {
  for (const [metricName, metric] of Object.entries(entries)) {
    await measure(connection, metric, metricName);
  }
}

app.get("/", (req, res) => {
  res.redirect("/metrics");
});

app.get("/version", (req, res) => {
  res.json({
    version: version,
    repository: "https://github.com/awaragi/prometheus-mssql-exporter",
  });
});

app.get("/metrics", async (req, res) => {
  res.contentType(client.register.contentType);

  try {
    appLog("Received /metrics request");
    let connection = await connect();
    await collect(connection);
    connection.close();
    res.send(client.register.metrics());
    appLog("Successfully processed /metrics request");
  } catch (error) {
    // error connecting
    appLog("Error handling /metrics request");
    const mssqlUp = entries.mssql_up.metrics.mssql_up;
    mssqlUp.set(0);
    res.header("X-Error", error.message || error);
    res.send(client.register.getSingleMetricAsString(mssqlUp.name));
  }
});

const server = app.listen(config.port, function () {
  console.log(`Prometheus MSSQL Exporter v${version}`);
  console.log(`Repository: https://github.com/awaragi/prometheus-mssql-exporter`);
  appLog(
    `Listening on local port ${config.port} monitoring ${config.connect.authentication.options.userName}@${config.connect.server}:${config.connect.options.port}`
  );
});

process.on("SIGINT", function () {
  server.close();
  process.exit(0);
});
