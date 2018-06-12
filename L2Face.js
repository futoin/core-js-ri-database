'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
class L2Face extends L1Face {
    /** Read Uncomitted isolation level constant */
    static get READ_UNCOMMITTED() {
        return 'RU';
    }
    /** Read Comitted isolation level constant */
    static get READ_COMMITTED() {
        return 'RC';
    }
    /** Repeatable Read isolation level constant */
    static get REPEATABL_READ() {
        return 'RR';
    }
    /** Serializable */
    static get SERIALIZABLE() {
        return 'SRL';
    }

    /** Read Uncomitted isolation level constant */
    get READ_UNCOMMITTED() {
        return L2Face.READ_UNCOMMITTED;
    }
    /** Read Comitted isolation level constant */
    get READ_COMMITTED() {
        return L2Face.READ_COMMITTED;
    }
    /** Repeatable Read isolation level constant */
    get REPEATABL_READ() {
        return L2Face.REPEATABL_READ;
    }
    /** Serializable */
    get SERIALIZABLE() {
        return L2Face.SERIALIZABLE;
    }

    static get IFACE_NAME() {
        return 'futoin.db.l2';
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
    newXfer( iso_level=L2Face.READ_COMMITTED ) {
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
                result : {
                    type : "boolean",
                    optional : true,
                    desc : "Return result of the statement",
                },
                template : {
                    type : "boolean",
                    optional : true,
                    desc : "Process value back references",
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
            items : [
                "RU",
                "RC",
                "RR",
                "SRL",
            ],
            desc : "Refers to standard ISO isolation levels",
        },
    },
    funcs : {
        xfer : {
            params : {
                ql : "XferQueryList",
                isol : "IsolationLevel",
            },
            result : "XferResultList",
            throws : [
                "InvalidQuery",
                "Duplicate",
                "OtherExecError",
                "LimitTooHigh",
                "DeadLock",
                "XferCondition",
                "XferBackRef",
            ],

        },
    },
};
