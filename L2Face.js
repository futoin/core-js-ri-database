'use strict';

const PingFace = require( 'futoin-invoker/PingFace' );
const L1Face = require( './L1Face' );
const XferBuilder = require( './XferBuilder' );

/**
 * @class
 * @name XferQuery
 * @property {string} q - raw query
 * @property {interger|boolean|null} affected - expected count of rows to be affected
 * @property {interger|boolean|null} selected - expected count of rows to be selected
 * @property {boolean|null} result - mark to return result in response
 */

/**
 * Level 2 Database Face
 */
class L2Face extends L1Face
{
    /** Read Uncomitted isolation level constant */
    static get READ_UNCOMMITTED()
    {
        return 'RU';
    }
    /** Read Comitted isolation level constant */
    static get READ_COMMITTED()
    {
        return 'RC';
    }
    /** Repeatable Read isolation level constant */
    static get REPEATABL_READ()
    {
        return 'RR';
    }
    /** Serializable */
    static get SERIALIZABLE()
    {
        return 'SRL';
    }

    /** Read Uncomitted isolation level constant */
    get READ_UNCOMMITTED()
    {
        return L2Face.READ_UNCOMMITTED;
    }
    /** Read Comitted isolation level constant */
    get READ_COMMITTED()
    {
        return L2Face.READ_COMMITTED;
    }
    /** Repeatable Read isolation level constant */
    get REPEATABL_READ()
    {
        return L2Face.REPEATABL_READ;
    }
    /** Serializable */
    get SERIALIZABLE()
    {
        return L2Face.SERIALIZABLE;
    }

    /**
     * CCM registration helper
     * 
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=1.0] - interface version to use
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} )
    {
        const ifacever = options.version || '1.0';
        const iface = this.spec( ifacever );
        const l1_iface = L1Face.spec( ifacever );

        options.nativeImpl = this;
        options.specDirs = [ iface, l1_iface, PingFace.spec( '1.0' ) ];

        ccm.register(
            as,
            name,
            iface.iface + ':' + ifacever,
            endpoint,
            credentials,
            options
        );

        as.add( ( as ) =>
        {
            this.getFlavour( as );
        } );
    }

    /**
     * Get new transcation builder.
     * @param {string} [iso_level=RC] - RU, RC, RR or SRL
     * @see L2Face#READ_UNCOMMITTED
     * @see L2Face#READ_COMMITTED
     * @see L2Face#REPEATABL_READ
     * @see L2Face#SERIALIZABLE
     * @returns {XferBuilder} transaction builder instance
     */
    newXfer( iso_level=L2Face.READ_COMMITTED )
    {
        return new XferBuilder( this, this._db_type, iso_level );
    }

    /**
     * Execute query list in transaction of specific isolation level
     * @name L2Face#xfer
     * @param {array} query_list - list of XferQuery objects
     * @param {string} isolation_level - isolation level
     */
}

module.exports = L2Face;

const specs = {};
L2Face._specs = specs;

specs['1.0'] = {
    iface : "futoin.db.l2",
    version : "1.0",
    ftn3rev : "1.7",
    inherit : "futoin.db.l1:1.0",
    types : {
        IntOrBool : [ "integer", "boolean" ],
        XferQuery : {
            type : "map",
            fields : {
                q : "Query",
                affected : {
                    type : "IntOrBool",
                    optional : true,
                    desc : "Require changed row count: specific or > 0, if true",
                },
                selected : {
                    type : "IntOrBool",
                    optional : true,
                    desc : "Require selected row count: specific or > 0, if true",
                },
                return : {
                    type : "boolean",
                    optional : true,
                    desc : "Return result of the statement",
                },
            },
        },
        XferQueryList : {
            type : "array",
            elemtype : "XferQuery",
            minlen : 1,
            maxlen : 100,
        },
        XferResult : {
            type : "map",
            fields : {
                seq : "integer",
                rows : "Rows",
                fields : "Fields",
                affected : "integer",
            },
        },
        XferResultList : {
            type : "array",
            elemtype : "XferResult",
            minlen : 0,
            maxlen : 100,
        },
        IsolationLevel : {
            type : "enum",
            items : [ "RU", "RC", "RR", "SRL" ],
            desc : "Refers to standard ISO isolation levels",
        },
    },
    funcs : {
        xfer : {
            params : {
                ql : "XferQueryList",
                isol : "IsolationLevel",
            },
            result : { results : "XferResultList" },
            throws : [ "InvalidQuery", "Duplicate", "OtherExecError", "LimitTooHigh" ],

        },
    },
};
