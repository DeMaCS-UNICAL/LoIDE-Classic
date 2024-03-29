const { series, src, dest, parallel } = require("gulp");
const csso = require("gulp-csso");
const clean = require("gulp-clean");
const autoprefixer = require("gulp-autoprefixer");
const uglify = require("gulp-uglify-es").default;
const nodemon = require("gulp-nodemon");
var browserSync = require("browser-sync").create();
var babel = require("gulp-babel");
const inject = require("gulp-inject-string");
const htmlmin = require("gulp-html-minifier-terser");

const path = {
    dist: "dist/",
    src: "resources/",
};

const environment = {
    dev: "development",
    prod: "production",
};

// System config loading
var properties = require("./config/app-config.json");
var httpPort = properties.port.http;

function cleanDir() {
    return src(path.dist + "*", { read: false }).pipe(clean());
}

function css() {
    return src(path.src + "css/*.css")
        .pipe(
            autoprefixer({
                cascade: false,
            })
        )
        .pipe(csso())
        .pipe(dest(path.dist + "css/"));
}

function faviconImage() {
    return src(path.src + "favicon/*.{png,svg}").pipe(
        dest(path.dist + "favicon/")
    );
}

function faviconFiles() {
    return src(path.src + "favicon/*.{ico,xml,webmanifest}").pipe(
        dest(path.dist + "favicon/")
    );
}

function img() {
    return src(path.src + "img/*.*").pipe(dest(path.dist + "img/"));
}

function js() {
    return src(path.src + "js/**/*.js")
        .pipe(babel())
        .pipe(uglify())
        .pipe(dest(path.dist + "js/"));
}

function html() {
    let properties = require("./config/app-config.json");
    let pckg = require("./package.json");
    return src(path.src + "**/*.html")
        .pipe(inject.replace("#{loideURL}", properties.loide_url))
        .pipe(inject.replace("#{loideVersion}", pckg.version))
        .pipe(
            htmlmin({
                collapseWhitespace: true,
                removeComments: true,
                removeEmptyAttributes: true,
            })
        )
        .pipe(dest(path.dist));
}

function serveProd(done) {
    const server = nodemon({
        script: "app.js",
        ext: "js json",
        ignore: ["node_modules/", "dist/", "resources/", "gulpfile.js"],
        env: { NODE_ENV: environment.prod },
    });

    server.on("start", () => {
        done();
    });
}

function serveDev(done) {
    const STARTUP_TIMEOUT = 5000;
    const server = nodemon({
        script: "app.js",
        stdout: false,
        ext: "js json",
        ignore: ["node_modules/", "dist/", "resources/", "gulpfile.js"],
        env: { NODE_ENV: environment.dev },
    });
    let starting,
        restarting,
        crashed = false;

    const onReady = () => {
        starting = false;
        if (restarting && !crashed) browserSync.reload();
        restarting = false;
        crashed = false;
        done();
    };

    server.on("start", () => {
        starting = true;
        setTimeout(onReady, STARTUP_TIMEOUT);
    });

    server.on("stdout", (stdout) => {
        process.stdout.write(stdout); // pass the stdout through
        if (starting || restarting) {
            onReady();
        }
    });

    server.on("restart", () => {
        browserSync.notify("Reastarting LoIDE, please wait!");
        restarting = true;
    });

    server.on("crash", () => {
        browserSync.notify("LoIDE crashed!", 5000);
        crashed = true;
    });
}

function startBrowserSync(done) {
    browserSync.init(
        {
            proxy: "http://localhost:" + httpPort,
            files: [path.src + "/**/*.*"],
            port: 7000,
        },
        done
    );
}

const build = parallel(css, faviconImage, faviconFiles, img, js, html);

exports.default = series(cleanDir, build, serveProd);
exports.dev = series(cleanDir, serveDev, startBrowserSync);
exports.build = series(cleanDir, build);
exports.clean = series(cleanDir);
