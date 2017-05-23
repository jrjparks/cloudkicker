const gulp = require("gulp");

const typescript = require("gulp-typescript");
const tslint = require("gulp-tslint");

const mocha = require('gulp-mocha');

const sourcemaps = require("gulp-sourcemaps");
const clean = require("gulp-clean");
const sequence = require('gulp-sequence');

const tsProject = typescript.createProject("tsconfig.json");

gulp.task("clean:ts", () =>
  gulp.src(`${tsProject.config.compilerOptions.outDir}/*`, {
    read: false
  })
  .pipe(clean())
);

gulp.task("build:ts", () => {
  let tsResult = tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject()),
    jsDest = gulp.dest(tsProject.config.compilerOptions.outDir);
  return sequence([
    tsResult.dts.pipe(jsDest),
    tsResult.js.pipe(sourcemaps.write("./")).pipe(jsDest)
  ]);
});

gulp.task("lint:ts", () =>
  tsProject.src()
  .pipe(tslint({
    formatter: "prose"
  }))
  .pipe(tslint.report())
);

gulp.task("rebuild:ts", sequence("clean:ts", "build:ts"));

gulp.task("default", sequence("lint:ts", "rebuild:ts"));
