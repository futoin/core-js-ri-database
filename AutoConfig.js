'use strict';

const _cloneDeep = require( 'lodash/cloneDeep' );
const _extend = require( 'lodash/extend' );
const _defaults = require( 'lodash/defaults' );

const Executor = require( 'futoin-executor/Executor' );

const L1Face = require( './L1Face' );
const L2Face = require( './L2Face' );
const L1Service = require( './L1Service' );
const L2Service = require( './L2Service' );

// auto-configure QueryBuilder drivers
const main = require( './main' );
void main;

const serviceImpl = {
    mysql : './MySQLService',
    postgresql : './PostgreSQLService',
    sqlite : './SQLiteService',
};

/**
 * @private
 * @param {AsyncSteps} as - steps interface
 * @param {AdvancedCCM} ccm - CCM
 * @param {string} name - iface name
 * @param {object} options - service options
 */
function create( as, ccm, name, options )
{
    const factory = serviceImpl[options.type];
    let service;

    if ( typeof factory === "string" )
    {
        service = require( factory );
    }
    else if ( typeof factory === "function" &&
              factory.prototype instanceof L1Service )
    {
        service = factory;
    }
    else if ( typeof factory === "function" )
    {
        service = factory();
    }
    else
    {
        as.error( 'InternalError', `Unknown factory type ${factory} for ${options.type}` );
    }

    const executor = new Executor( ccm );
    service = service.register( as, executor, options );

    if ( service instanceof L2Service )
    {
        L2Face.register( as, ccm, `#db.${name}`, executor );
    }
    else if ( service instanceof L1Service )
    {
        L1Face.register( as, ccm, `#db.${name}`, executor );
    }
    else
    {
        as.error( 'InternalError',
            `Unknown service type "${typeof service}" for ${name}` );
    }

    if ( name === 'default' )
    {
        ccm.alias( `#db.${name}`, '#db' );
    }

    if ( !ccm.db )
    {
        /**
         * Retrieve database interface.
         *
         * @name AdvancedCCM#db
         * @param {string} [name=default] - connection name
         * @returns {object} FTN14 native face
         * @note Monkey-patched only for related CCM
         */
        ccm.db = function( name )
        {
            return this.iface( '#db.' + ( name || "default" ) );
        };
    }

    // Make sure to show unexpected internal errors to user
    executor.on( 'notExpected', function()
    {
        try
        {
            ccm.log().error( 'Not expected DB service error' );
            ccm.log().error( `${arguments[0]}: ${arguments[3]}` );
        }
        catch ( e )
        {
            console.error( 'Not expected DB service error' );
            console.error( arguments );
        }
    } );

    // Make sure to shutdown processing on CCM close
    ccm.on( 'close', () => executor.close() );
}

/**
 * @brief Automatically configure database connections
 *        and related internal Executors.
 *
 * For each config entry an instance of dedicated
 * Executor with registered database service is created and
 * related interface is registered on CCM.
 *
 * Interfaces are registered as "#db.{key}". The "default" one
 * is also aliased as "#db".
 *
 * Env patterns to service configuration:
 * - DB_{name}_HOST -> host
 * - DB_{name}_PORT -> port
 * - DB_{name}_SOCKET -> port (overrides DB_PORT)
 * - DB_{name}_USER -> user
 * - DB_{name}_PASS -> password
 * - DB_{name}_DB -> database
 * - DB_{name}_MAXCONN -> conn_limit
 * - DB_{name}_TYPE - type of database, fails if mismatch configuration
 * Note: the variables names are driven by CodingFuture CFDB Puppet module.
 *
 * The "default" key also tries env without "{name}_" infix.
 *
 * Example:
 * ```javascript
 *  AutoConfig(ccm, {
 *      "default": {
 *          type: ["mysql", "postgresql"],
 *          // DB_DEFAULT_TYPE or DB_TYPE must match any of them
 *      },
 *      readonly: {
 *          type: "mysql"
 *          // fail, if DB_READONLY_TYPE != mysql
 *      },
 *      preset: {
 *          type: "postgresql",
 *          host: "127.0.0.1",
 *          port: 5432,
 *          user: "test",
 *          password: "test",
 *          database: "test",
 *          conn_limit: 10,
 *          // no need to env variables - all is preset
 *      },
 *  })
 * ```
 *
 * @name AutoConfig
 * @param {AsyncSteps} as - async steps interface
 * @param {AdvancedCCM} ccm - CCM instance
 * @param {object} [config=null] - expected connection key => type map
 * @param {object} [env=process.env] - source of settings
 *
 * @note it also monkey patches CCM with #db(name="default") method
 */
module.exports = function( as, ccm, config=null, env=process.env )
{
    config = config || { default: {} };

    for ( let name in config )
    {
        let uname = name.toUpperCase();
        let options = _cloneDeep( config[name] );

        let detected = {
            type: env[`DB_${uname}_TYPE`],
            host: env[`DB_${uname}_HOST`],
            port: env[`DB_${uname}_SOCKET`] ||
                    parseInt( env[`DB_${uname}_PORT`] || '0' ) || undefined,
            user: env[`DB_${uname}_USER`],
            password: env[`DB_${uname}_PASS`] || undefined,
            database: env[`DB_${uname}_DB`] || undefined,
            conn_limit: parseInt( env[`DB_${uname}_MAXCONN`] || '0' ) || undefined,
        };

        if ( name === 'default' )
        {
            _defaults( detected, {
                type: env[`DB_TYPE`],
                host: env[`DB_HOST`],
                port: env[`DB_SOCKET`] ||
                        parseInt( env[`DB_PORT`] || '0' ) || undefined,
                user: env[`DB_USER`],
                password: env[`DB_PASS`] || undefined,
                database: env[`DB_DB`] || undefined,
                conn_limit: parseInt( env[`DB_MAXCONN`] || '0' ) || undefined,
            } );
        }

        _defaults( detected, { conn_limit: 1 } );

        let db_type = options.type;

        if ( db_type )
        {
            if ( db_type instanceof Array &&
                db_type.indexOf( detected.type ) >= 0 )
            {
                // pass
            }
            else if ( db_type === detected.type )
            {
                // pass
            }
            else
            {
                as.error( 'InternalError',
                    `DB type mismatch for ${name}: ${db_type} != ${detected.type}` );
            }
        }

        _extend( options, detected );
        create( as, ccm, name, options );
    }
};

/**
 * Register database service type.
 * @name AutoConfig.register
 * @param {string} type - type of database
 * @param {string|callable|object} factory - module name, factory method
 *      or a subclass of L1Service
 */
module.exports.register = function( type, factory )
{
    serviceImpl[type] = factory;
};
