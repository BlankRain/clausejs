var oAssign = require( '../utils/objectAssign' );
var ClauseRef = require( '../models/ClauseRef' );
var { cat, or, fclause, shape } = require( '../core' );
var isClause = require( '../utils/isClause' );
var isPred = require( '../utils/isPred' );
var isBool = require( '../preds/isBool' );
var walk = require( '../walk' );
var resolveWithRegistry = require( './resolve' );
var coerceIntoClause = require( '../utils/coerceIntoClause' );
var oPath = require( './simpleObjectPath' );

var { isNamespacePath, isClauseRef } = require( '../utils' );
const { GetNSFnClause, SetNSFnClause, NamespaceFnClause,
  SetMetaFnClause, GetMetaFnClause } = require( '../clauses/namespace.types' );
var reg;

var _get = fclause( {
  args: cat( isNamespacePath ),
  ret: isClauseRef,
} ).instrument( _getUnchecked );

function _getUnchecked( ref ) {
  function getFn( prefix ) {
    var path = reg;
    if ( prefix ) {
      path = prefix + ref;
    } else {
      path = ref;
    }
    var nObj = oPath.get( reg, _slashToDot( path ) );

    if ( nObj ) {
      return oAssign( nObj[ '.expr' ], nObj[ '.meta' ] );
    } else {
      return undefined;
    }
  }

  var sr = new ClauseRef( { ref, getFn, conformFn: null } );
  sr.conform = function clauseRefConform( x ) {
    var ss = getFn();
    return walk( ss, x, { conform: true } );
  }
  return sr;
}

function _slashToDot( p ) {
  return p.replace( /^(.+)(\/)(.+)$/, '$1.$3' ).replace( /^\//, '' );
}

// var PartialRefMapClause = shape({
//   req: {
//     'refDefs': [isNamespacePath, ExprOrPartialRefMapClause]
//   }
// });

function getNamespacePath( { nsPath } ) {
  var retVal;

  var nameObj = _get( nsPath );
  retVal = nameObj;

  return retVal;
}

function setNamespacePath( { nsPath, expression } ) {
  _processVal( nsPath, expression );
}

function _processVal( prefix, expression ) {
  if ( expression ) {
    if ( expression.clause || expression.pred ) {
      var expr = expression.clause || expression.pred;
      _set( prefix, { '.expr': expr } );
      return expr;
    } else {
      console.error( expression );
      throw '!';
    }
  // TODO
  // } else if ( val.partialRefMap ) {
  //   var { refDefs } = val.partialRefMap;
  //   for ( var k in refDefs ) {
  //     if ( refDefs.hasOwnProperty( k ) ) {
  //       var retVal = _processVal( refDefs[ k ] );
  //     }
  //   }
  } else {
    console.error( expression );
    throw '!';
  }
}

var NameObjClause = shape( {
  req: { '.expr': or( isClause, isPred ) }
} );

var _set = fclause( {
  args: cat( isNamespacePath, NameObjClause ),
  ret: isBool,
} ).instrument( function _set( n, nObj ) {
  _maybeInitRegistry();
  var existing = oPath.get( reg, _slashToDot( n ) );
  oPath.set( reg, _slashToDot( n ), oAssign( {}, existing, nObj ) );
  return true;
} );

var K = '___CLAUSEJS_REGISTRY';

function _maybeInitRegistry() {
  if ( !reg ) {
    clearRegistry();
  }
  return reg;
}

function clearRegistry() {
  reg = global[ K ] = {};
}

const setMeta = SetMetaFnClause.instrumentConformed(
  function setMeta( { source: { namespacePath, expression }, metaObj, registry } ) {
    if ( !registry ) {
      registry = reg;
    }
    if ( namespacePath ) {
      var nObj = oPath.get( registry, _slashToDot( namespacePath ) );
      var currMeta = nObj && nObj[ '.meta' ];
      oPath.set( registry, _slashToDot( namespacePath ), oAssign( {}, nObj, { '.meta': oAssign( {}, currMeta, metaObj ) } ) );
    } else if ( expression ) {
      const clause = coerceIntoClause( expression );
      clause.meta = oAssign( clause.meta, metaObj );
    }
  }
);

const getMeta = GetMetaFnClause.instrumentConformed(
  function getMeta( { source: { namespacePath, expression }, registry } ) {
    if ( !registry ) {
      registry = reg;
    }
    if ( namespacePath ) {
      let nObj = oPath.get( registry, _slashToDot( namespacePath ) );
      let meta = nObj && nObj[ '.meta' ];
      return meta;
    } else if ( expression ) {
      const clause = coerceIntoClause( expression );
      return clause.meta;
    }
  }
);

function resolve( expr, reg ) {
  if ( !reg ) {
    return resolveWithRegistry( expr, getRegistry() );
  } else {
    return resolveWithRegistry( expr, reg );
  }
}

_maybeInitRegistry();

const getRegistry = () => reg;

var namespaceGetOrSet = NamespaceFnClause.instrumentConformed(
  function namespaceGetOrSet( { register, retrieve } ) {
    if ( register ) {
      return setNamespacePath( register );
    } else if ( retrieve ) {
      return getNamespacePath( retrieve );
    }
  }
)

namespaceGetOrSet.get = GetNSFnClause.instrumentConformed( getNamespacePath );
namespaceGetOrSet.set = SetNSFnClause.instrumentConformed( setNamespacePath );
namespaceGetOrSet.clearRegistry = clearRegistry;
namespaceGetOrSet.getRegistry = getRegistry;
namespaceGetOrSet.setMeta = setMeta;

export {
  getRegistry, clearRegistry, setMeta, getMeta,
  resolve };
export default namespaceGetOrSet;
