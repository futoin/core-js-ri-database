'use strict';

// Libraries not ready for frozen Object.prototype

// https://github.com/MikeMcl/bignumber.js/pull/144
require( 'bignumber.js' );

//
require( 'moment' );
require( 'tough-cookie' );

Object.freeze( Object.prototype );
