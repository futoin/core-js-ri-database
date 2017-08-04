/* jshint ignore:start */

var fs = require('fs');

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
                     
        jshint: {
            options: {
                jshintrc : true,
            },
            all: ['*.js', 'lib/**/*.js'],
        },
        jscs: {
            options : {
                config: ".jscsrc",
                fix: true,
            },
            all: ['*.js', 'lib/**/*.js'],
        },
        mocha_istanbul: {
            coverage: {
                src: [
                    'test/querytest.js',
                     'test/buildertest.js',
                     'test/xfertest.js',
                ],
            }
        },
        istanbul_check_coverage: {},
        jsdoc2md: {
            README: {
                src: [ '*.js', 'lib/**/*.js' ],
                dest: "README.md",
                options: {
                    template: fs.readFileSync('misc/README.hbs','utf8'),
}
            }
        },
        replace: {
            README: {
                src: "README.md",
                overwrite: true,
                replacements: [{
                    from: "$$pkg.version$$",
                    to: "<%= pkg.version %>"
                }]
            }
        }
    });
    
    grunt.loadNpmTasks( 'grunt-contrib-jshint' );
    grunt.loadNpmTasks( 'grunt-jscs' );
    grunt.loadNpmTasks( 'grunt-mocha-istanbul' );
    
    grunt.registerTask( 'check', [ 'jshint', 'jscs' ] );
    
    grunt.registerTask( 'node', [ 'connect', 'mocha_istanbul', 'mocha_istanbul:coverage' ] );
    grunt.registerTask( 'test', [ 'check', 'node', 'doc' ] );
    
    grunt.loadNpmTasks( 'grunt-jsdoc-to-markdown' );
    grunt.loadNpmTasks( 'grunt-text-replace' );
    grunt.registerTask( 'doc', [ 'jsdoc2md:README', 'replace:README' ] );

    grunt.registerTask( 'default', ['check'] );
};
