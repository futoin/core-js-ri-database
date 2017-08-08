'use strict';

const PingFace = require( 'futoin-invoker/PingFace' );
const L1Face = require( './L1Face' );

/**
 * Level 2 Database Face
 */
class L2Face extends L1Face
{
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
}

module.exports = L2Face;

const specs = {};
L2Face._specs = specs;

specs['1.0'] = {
    iface: "futoin.db.l2",
    version: "1.0",
    ftn3rev: "1.6",
    inherit: "futoin.db.l1:1.0",
    types: {
        IntOrBool: [ "integer", "boolean" ],
        XferQuery: {
            type: "map",
            fields: {
                q: "Query",
                affected: {
                    type: "IntOrBool",
                    optional: true,
                    desc: "Require changed row count: specific or > 0, if true",
                },
                selected: {
                    type: "IntOrBool",
                    optional: true,
                    desc: "Require selected row count: specific or > 0, if true",
                },
                return: {
                    type: "boolean",
                    optional: true,
                    desc: "Return result of the statement",
                },
            },
        },
        XferQueryList: {
            type: "array",
            elemtype: "XferQuery",
            minlen: 1,
            maxlen: 100,
        },
        XferResult: {
            type: "map",
            fields: {
                rows: "Rows",
                fields: "Fields",
                affected: "integer",
            },
        },
        XferResultList: {
            type: "array",
            elemtype: "XferResult",
            minlen: 0,
            maxlen: 100,
        },
        IsolationLevel: {
            type: "enum",
            items: [ "RU", "RC", "RR", "SRL" ],
            desc: "Refers to standard ISO isolation levels",
        },
    },
    funcs: {
        xfer: {
            params: {
                ql: "XferQuery",
                isol: "IsolationLevel",
            },
            result: { results: "XferResultList" },
            throws: [ "InvalidQuery", "Duplicate", "OtherExecError", "LimitTooHigh" ],
        },
    },
};
