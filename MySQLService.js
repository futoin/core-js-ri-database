'use strict';

const L2Service = require( './L2Service' );

/**
 * MySQL service implementation for FutoIn Database interface
 */
class MySQLService extends L2Service
{
    query( as, reqinfo )
    {
        as.error( 'TODO' );
        void reqinfo;
    }

    callStored( as, reqinfo )
    {
        as.error( 'TODO' );
        void reqinfo;
    }

    getFlavour( as, reqinfo )
    {
        as.error( 'TODO' );
        void reqinfo;
    }

    xfer( as, reqinfo )
    {
        as.error( 'TODO' );
        void reqinfo;
    }
}

module.exports = MySQLService;
