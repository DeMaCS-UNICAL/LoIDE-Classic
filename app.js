var helmet = require("helmet");
var express = require("express");
var https = require("https");
var http = require("http");
var forceSSL = require("express-force-ssl");
var fs = require("fs");
var jpointer = require("json-pointer");
const compression = require("compression");

const environment = {
    dev: "development",
    prod: "production",
};

const path = {
    dist: "dist",
    src: "resources",
};

const currentEnv = process.env.NODE_ENV || environment.dev;
const resourcesPath = currentEnv == environment.prod ? path.dist : path.src;

// System config loading
var properties = require("./config/app-config.json");
var httpPort = properties.port.http;
var httpsPortP = properties.port.https;
var key = properties.path.key;
var cert = properties.path.cert;
var maxAge = properties.max_age;

// This function validates the JSON schemas
var Ajv = require("ajv");
validateJsonSchemas();

var pckg = require("./package.json");

var app = express();

var server = http.createServer(app);

var enableHTTPS = false;

if (key.length !== 0 && cert.length !== 0) {
    enableHTTPS = true;

    var options = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
    };

    // Enable redirect from HTTP to HTTPS
    app.use(forceSSL);
    app.set("forceSSLOptions", {
        httpsPort: httpsPortP,
    });

    var secureServer = https.createServer(options, app);
}

// Sets "Strict-Transport-Security, by default maxAge is set 1 year in seconds
app.use(
    helmet({
        hsts: {
            maxAge: maxAge,
        },
        contentSecurityPolicy: false,
    })
);

app.use(compression());
app.use(express.static(resourcesPath));

if (enableHTTPS) {
    secureServer.listen(httpsPortP, function () {
        print_log("App listening on secure port " + httpsPortP);
        print_log("Version: " + pckg.version);
    });
}

server.listen(httpPort, function () {
    print_log("App listening on port " + httpPort);
    print_log("Version: " + pckg.version);
});

function print_log(statement) {
    console.log("%s: %s", new Date().toLocaleString(), statement); // debug string
}

function validateJsonSchemas() {
    // Validate JSON file with the relative scheme
    var appConfigValidation = validateSchema(
        "./config/app-config.json",
        "./config/app-config-schema.json"
    );

    if (appConfigValidation.criticalError) {
        console.log(
            "Fatal error: configuration files are not setted up properly!"
        );
        process.exit(1);
    }
}

function validateSchema(jsonPath, schemaPath) {
    // Loading files
    var json = require(jsonPath);
    var schema = require(schemaPath);

    // Config
    var ajv = new Ajv({
        allErrors: true,
        jsonPointers: true,
    });

    // Compiling the schema
    var compiledSchema = ajv.compile(schema);
    var validated = false;
    var printError = true;
    var response = {};

    while (!validated) {
        // Validating
        var validatedJson = compiledSchema(json);
        // If some there is some error, the nearest parent object in the file, containing this error, is deleted
        if (!validatedJson) {
            // Prints the errors only the first time
            if (printError) {
                console.log(compiledSchema.errors);
                printError = false;
            }

            for (var index in compiledSchema.errors) {
                var path = compiledSchema.errors[index].dataPath;
                if (path === "") {
                    // 'This' case happen when there is a problem in to the root of the json file (eg. when the file is empty)
                    console.log(
                        "Fatal error: " +
                            jsonPath +
                            " is not setted up properly!"
                    );
                    response.criticalError = true;
                    validated = true;
                } else {
                    jpointer.remove(json, path);
                }
            }
        } else {
            console.log("Validated: " + jsonPath);
            validated = true;
        }
    }

    return response;
}
