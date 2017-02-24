const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const browserify = require('browserify');
const watchify = require('watchify');
const babel = require('babelify');
const merge = require('utils-merge');
const rename = require('gulp-rename');
const uglify = require('gulp-uglify');

const gutil = require('gulp-util');
const chalk = require('chalk');

function map_error(err) {
	if (err.fileName) {
		// regular error
		gutil.log(chalk.red(err.name)
			+ ': '
			+ chalk.yellow(err.fileName.replace(__dirname + '/src/js/', ''))
			+ ': '
			+ 'Line '
			+ chalk.magenta(err.lineNumber)
			+ ' & '
			+ 'Column '
			+ chalk.magenta(err.columnNumber || err.column)
			+ ': '
			+ chalk.blue(err.description));
	} else {
		// browserify error..
		gutil.log(chalk.red(err.name)
			+ ': '
			+ chalk.yellow(err.message));
	}

	this.end();
}

function compile(watch) {
	var bundler = watchify(browserify('./src/index.js', { debug: true }).transform(babel,{presets: ['es2015']}));

	function rebundle() {
		bundler.bundle()
			.on('error', map_error)
			.pipe(source('build.js'))
			.pipe(buffer())
			.pipe(gulp.dest('./build'))
			.pipe(rename('build.min.js'))
			.pipe(sourcemaps.init({ loadMaps: true }))
			.pipe(uglify())
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./build'));
	}

	if (watch) {
		bundler.on('update', function() {
			console.log('-> bundling...');
			rebundle();
		});
	}

	rebundle();
}

function watch() {
	return compile(true);
}

gulp.task('build', function() { return compile(); });
gulp.task('watch', function() { return watch(); });

gulp.task('default', ['watch']);