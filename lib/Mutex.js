'use strict';

/**
 * @file Mutex mutual exclusion mechanism for AsyncSteps
 * @author Andrey Galkin <andrey@futoin.eu>
 * @note to be moved to AsyncSteps
 */

class Mutex
{
    constructor()
    {
        this._locked = false;
        this._owner = new WeakSet();
        this._queue = [];
    }

    _lock( as )
    {
        if ( this._locked )
        {
            this._queue.push( as );
        }
        else
        {
            this._locked = true;
            this._owner.add( as.state );
            as.success();
        }
    }

    _release( as )
    {
        const owner = this._owner;
        const as_state = as.state;

        if ( owner.has( as_state ) )
        {
            owner.delete( as_state );

            if ( !this._locked )
            {
                as.error( 'InternalError', 'Mutex must be in locked state' );
            }

            this._locked = false;
            const queue = this._queue;

            while ( queue.length )
            {
                let other_as = queue.shift();

                if ( other_as.state )
                {
                    this._lock( other_as );
                    break;
                }
            }
        }
        else
        {
            const idx = this._queue.indexOf( as.state );

            if ( idx < 0 )
            {
                as.error( 'InternalError', 'Must be in Mutex queue' );
            }

            this._queue.splice( idx, 1 );
        }
    }

    synchronized( as, step, err_handler=null )
    {
        as.add( ( as ) =>
        {
            as.setCancel( ( as ) => this._release( as ) );
            this._lock( as );
        } );
        as.add( ( as ) =>
        {
            as.setCancel( ( as ) => this._release( as ) );
            as.add( step, err_handler );
        } );
        as.add( ( as ) => this._release( as ) );
    }
}

module.exports = Mutex;
