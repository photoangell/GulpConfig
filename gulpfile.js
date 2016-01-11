// Gulp.js configuration

//-------------------------------------
// include gulp and plugins
//-------------------------------------
var
	gulp = require('gulp'),								// need Gulp
	pkg = require('./package.json'),			// app config details
	imagemin = require('gulp-imagemin'),
	newer = require('gulp-newer'),
	del = require('del'),
	preprocess = require('gulp-preprocess'),
	htmlclean = require('gulp-htmlclean'),
	size = require('gulp-size'),
	sass = require('gulp-sass'),
	imacss = require('gulp-imacss'),
	pleeease = require('gulp-pleeease'),
	jshint = require('gulp-jshint'),
	concat = require('gulp-concat'),
	deporder = require('gulp-deporder'),
	stripdebug = require('gulp-strip-debug'),
	uglify = require('gulp-uglify')
	browsersync = require('browser-sync');

//-------------------------------------
// vars
//-------------------------------------

var
	devBuild = ((process.env.NODE_ENV || 'development').trim().toLowerCase() !== 'production'),   //returns bool depending on env var

	source = 'source/', //do not have absolute paths can cause probs with watch
	dest = 'build/',
	html = {
			in: source + '*.html',
			watch: [source + '*.html', source + 'template/**/*'], //all folders files
			out: dest,
			context: {
				devBuild: devBuild,
				author: pkg.author,
				version: pkg.version
			}
		},
	images = {
		in: source + 'images/*.*', // for all subfolders try images/**/*
		out: dest + 'images/'
	},

	imguri = {
		in: source + 'images/inline/*', //any icon type img
		out: source + 'scss/images/',		//out is the src scss!!!
		filename: '_datauri.scss',			//ready for processing
		namespace: 'img'								//css namespace
	},

	css = {
		in: source + 'scss/main.scss',
		//watch every css file for partial changes
		//but don't watch the imguri output!
		watch: [source + 'scss/**/*', '!' + imguri.out + imguri.filename],
		out: dest + 'css/',
		sassOpts: {
			outputStyle: 'nested', //or compressed
			imagePath: '../images', //appended to imgurl in sass files
			precision: 3,	//num of decimal places in any calcs
			errLogToConsole: true
		},
		pleeeaseOpts: {
			//support last two versions and where market share is > 2%
			autoprefixer: { browsers: ['last 2 versions', '> 2%'] },
			rem: ['16px'],				//px fallback for rem dimensions
			pseudoElements: true,	//forces :: to : for IE8 and below
			mqpacker: true,				//puts media queries to single dimension
			minifier: !devBuild		//minify in prod or dev...
		}
	},

	fonts = {
		in: source + 'fonts/*.*',
		out: css.out + 'fonts/'
	},

	js = {
		in: source + 'js/**/*', //any files in any folder
		out: dest + 'js/',
		filename: 'main.js'			//name of minified file
	},

	syncOpts = {
	server: {
		baseDir: dest,					//server runs off build,
														//BS can also run as a proxy off main web server
		index: 'index.html'
	},
	open: false,							//dont open a page on build
	notify: true							//pop toast when we do something
};

//-------------------------------------
//tasks
//-------------------------------------

// show build type
console.log(pkg.name + ' ' + pkg.version + ', ' + (devBuild ? 'development' : 'production') + ' build');


//delete everything in build folder
gulp.task('clean', function() {
	del([															//doesn't return, just call the func
		dest + '*'											//array of locations to del
	])
});

// build HTML files
gulp.task('html', function() {
	//dont return page right away
	var page = gulp.src(html.in).pipe(preprocess({ context: html.context }));
	//we need to minify if prod
	if (devBuild) {
		page = page
			.pipe(size({ title: 'HTML in' }))   //report on size before
			.pipe(htmlclean())
			.pipe(size({ title: 'HTML out' }));	//report on size after
	}
	return page.pipe(gulp.dest(html.out));
});

//manage images
gulp.task('images', function() {
	return gulp.src(images.in)   			//fetches images
		.pipe(newer(images.out))
		.pipe(imagemin()) 							//pipe through image min
		.pipe(gulp.dest(images.out));		//pipes them to dest folder
});

// convert inline images to dataURIs in SCSS source
gulp.task('imguri', function() {
	return gulp.src(imguri.in)
		.pipe(imagemin())								//squish em first
		.pipe(imacss(imguri.filename, imguri.namespace))
		.pipe(gulp.dest(imguri.out));
});

// compile Sass
gulp.task('sass', ['imguri'], function() { //we also run imguri in here first
	return gulp.src(css.in)
		.pipe(sass(css.sassOpts))
		.pipe(size({title: 'CSS in '}))		//report size changes
		.pipe(pleeease(css.pleeeaseOpts))
		.pipe(size({title: 'CSS out '}))
		.pipe(gulp.dest(css.out))
		.pipe(browsersync.reload({ stream: true })); //stream css changes direct to browser
});

// copy fonts
gulp.task('fonts', function() {
	return gulp.src(fonts.in)
		.pipe(newer(fonts.out))
		.pipe(gulp.dest(fonts.out));
});


//handle js
gulp.task('js', function() {
	if (devBuild) {												// only hint in dev
		return gulp.src(js.in)
			.pipe(newer(js.out))							//newer files only
			.pipe(jshint())										//check it
			.pipe(jshint.reporter('default'))	//report to console
			.pipe(jshint.reporter('fail'))		//if errors, abort!!!
			.pipe(gulp.dest(js.out));
		} else {														// for prod
			del([dest + 'js/*']);							//del all js in build
			return gulp.src(js.in)
				.pipe(deporder())								// ducks in a row
				.pipe(concat(js.filename))			// join em!
				.pipe(size({ title: 'JS in '}))
				.pipe(stripdebug())							// remove debugs
				.pipe(uglify())									// make smaller, check options available
				.pipe(size({ title: 'JS out '}))
				.pipe(gulp.dest(js.out));				// js.out is our one js file
		}
});

// browser sync
gulp.task('browsersync', function() {
	browsersync(syncOpts);						//not a gulp plugin, so dont return anything
});

//-------------------------------------
// default task
//-------------------------------------

//second param can be array of names of other tasks to run...
//however, all tasks will run simultaneously, beware of dependancies
gulp.task('default', ['html', 'images', 'fonts', 'sass', 'js', 'browsersync'], function() {

	// html changes
	//watching html.watch as more files to monitor
	//also call the browsersync reload
	gulp.watch(html.watch, ['html', browsersync.reload]);

	//add a watch, keep it simple to keep speed up
	gulp.watch(images.in, //array of watch locations
		['images']); 				//array of tasks

	// sass changes in scss or inline images
	// exclusion of imguri scss output is handled in css obj
	gulp.watch([css.watch, imguri.in], ['sass']);

	// font changes
	gulp.watch(fonts.in, ['fonts']);

	// javascript changes
	gulp.watch(js.in, ['js', browsersync.reload]);
});
