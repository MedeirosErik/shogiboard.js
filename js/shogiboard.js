(function () {
    let $ = window['jQuery'];

    // ---------------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------------
    const FILES = '987654321'.split('');
    const RANKS = 'ihgfedcba'.split('');
    const DEFAULT_DRAG_THROTTLE_RATE = 20;
    const ELLIPSIS = '…';
    const MINIMUM_JQUERY_VERSION = '1.8.3';
    const START_SFEN = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';
    const START_POSITION = sfenToObj(START_SFEN);
    const HAND_REGEX = /^(\d*R)?(\d*B)?(\d*G)?(\d*S)?(\d*N)?(\d*L)?(\d*P)?(\d*r)?(\d*b)?(\d*g)?(\d*s)?(\d*n)?(\d*l)?(\d*p)?$/;
    const HAND_PIECES_ORDER = ['r', 'b', 'g', 's', 'n', 'l', 'p'];

    // default animation speeds
    const DEFAULT_APPEAR_SPEED = 200;
    const DEFAULT_MOVE_SPEED = 200;
    const DEFAULT_SNAPBACK_SPEED = 60;
    const DEFAULT_SNAP_SPEED = 30;
    const DEFAULT_TRASH_SPEED = 100;

    // CSS classes
    let CSS = {};
    CSS['board'] = 'shogiboard-board'; //
    CSS['boardBox'] = 'shogiboard-board-box'; //
    CSS['clearfix'] = 'shogiboard-clearfix';
    CSS['highlight1'] = 'shogiboard-highlight1';
    CSS['highlight2'] = 'shogiboard-highlight2';
    CSS['notation'] = 'shogiboard-notation';
    CSS['files'] = 'shogiboard-files';
    CSS['ranks'] = 'shogiboard-ranks';
    CSS['piece'] = 'shogiboard-piece';
    CSS['sparePieces'] = 'shogiboard-spare-pieces';
    CSS['sparePiecesBottom'] = 'shogiboard-spare-pieces-bottom';
    CSS['sparePiecesTop'] = 'shogiboard-spare-pieces-top';
    CSS['square'] = 'shogiboard-square';
    CSS['dots'] = 'shogiboard-dots';
    CSS['handBoard'] = 'shogiboard-hand-board';
    CSS['numbers'] = 'shogiboard-numbers';
    CSS['left'] = 'shogiboard-left';
    CSS['right'] = 'shogiboard-right';

	// ---------------------------------------------------------------------------
	// Misc Util Functions
	// ---------------------------------------------------------------------------

	function throttle (f, interval, scope) {
		let timeout = 0;
		let shouldFire = false;
		let args = [];

		let handleTimeout = function () {
			timeout = 0;
			if (shouldFire) {
				shouldFire = false;
				fire();
			}
		}

		let fire = function () {
			timeout = window.setTimeout(handleTimeout, interval);
			f.apply(scope, args);
		}

		return function (_args) {
			args = arguments;
			if (!timeout) {
				fire();
			} else {
				shouldFire = true;
			}
		}
	}

	function uuid () {
		return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, function (c) {
			let r = (Math.random() * 16) | 0;
			return r.toString(16);
		});
	}

	function deepCopy (thing) {
		return JSON.parse(JSON.stringify(thing));
	}

	function parseSemVer (version) {
		let tmp = version.split('.');
		return {
			major: parseInt(tmp[0], 10),
			minor: parseInt(tmp[1], 10),
			patch: parseInt(tmp[2], 10)
		};
	}

	// returns true if version is >= minimum
	function validSemanticVersion (version, minimum) {
		version = parseSemVer(version);
		minimum = parseSemVer(minimum);

		let versionNum = (version.major * 100000 * 100000) +
										 (version.minor * 100000) +
										 version.patch;
		let minimumNum = (minimum.major * 100000 * 100000) +
										 (minimum.minor * 100000) +
										 minimum.patch;

		return versionNum >= minimumNum;
	}

	function interpolateTemplate (str, obj) {
		for (let key in obj) {
			if (!obj.hasOwnProperty(key)) continue;
			let keyTemplateStr = '{' + key + '}';
			let value = obj[key];
			while (str.indexOf(keyTemplateStr) !== -1) {
				str = str.replace(keyTemplateStr, value);
			}
		}
		return str;
    }
    
	// ---------------------------------------------------------------------------
	// Predicates
	// ---------------------------------------------------------------------------

	function isString (s) {
		return typeof s === 'string';
	}

    function isFunction (f) {
        return typeof f === 'function';
    }

    function isInteger (n) {
        return typeof n === 'number' &&
            isFinite(n) && 
            Math.floor(n) === n;
    }

    function validAnimationSpeed (speed) {
        if (speed === 'fast' || speed === 'slow') return true;
        if (!isInteger(speed)) return false;
        return speed >= 0;
    }

    function validThrottleRate (rate) {
        return isInteger(rate) && rate >= 1;
    }

    function validMove (move) {
        // move should be a string
        if (!isString(move)) return false;
    
        // move should be in the form of "e2-e4", "f6-d5"
        let squares = move.split('-');
        if (squares.length !== 2) return false;
    
        return validSquare(squares[0]) && validBoardSquare(squares[1]);
    }

    function validSquare (square) {
        return validBoardSquare(square) || validHandSquare(square);
    }

    function validBoardSquare (square) {
        return isString(square) && square.search(/^[1-9][a-i]$/) !== -1;
    }

    function validHandSquare (square) {
        return isString(square) && square.search(/^[wb]h[PLNSGBR]$/) !== -1;
    }
    
    function validPieceCode (code) {
        return isString(code) && code.search(/^[wb][KRBGSNLP]\+?$/) !== -1;
    }

    function validSfen (sfen) {
        if (!isString(sfen)) return false;
    
        // separate sfen in 4 components
        sfen = sfen.split(' ');
    
        let board = sfen[0];
        let move = sfen[1];
        let hand = sfen[2];
        //let counter = sfen[3]; // not important
    
        // check board ------------------------------------------------
        // expand the empty suqare numbers to just 1s
        board = expandSfenEmptySquares(board);
    
        // SFEN should be 9 sections separated by slashes
        let chunks = board.split('/');
        if (chunks.length !== 9) 
            return false;
    
        // check each section
        for (let i = 0; i < 9; i++) {
            if (chunks[i].replace('+', '').length !== 9 || chunks[i].search(/^(?:(\+?[krbgsnlpKRBGSNLP])|1)+$/) !== 0)
                return false;    
        }
        // ------------------------------------------------------------
    
        // check move
        if (move !== 'b' && move !== 'w')
            return false;
        
        // check hand
        if (hand !== '-' && !HAND_REGEX.test(hand))
            return false;
    
        return true;
    }

    function validPositionObject (pos) {
        if (!$.isPlainObject(pos)) return false;
    
        for (let i in pos) {
            if (!pos.hasOwnProperty(i)) continue;
    
            if (!validBoardSquare(i) || !validPieceCode(pos[i])) {
                if (!validHandSquare(i) || !(isInteger(pos[i]) && pos[i] >= 0)) {
                    return false;
                }
            }
        }
    
        return true;
    }

    function isTouchDevice () {
        return 'ontouchstart' in document.documentElement;
    }

	function validJQueryVersion () {
		return typeof window.$ &&
					 $.fn &&
					 $.fn.jquery &&
					 validSemanticVersion($.fn.jquery, MINIMUM_JQUERY_VERSION);
	}

	// ---------------------------------------------------------------------------
	// Shogi Util Functions
	// ---------------------------------------------------------------------------

    // Convert SFEN piece code to bL, wP+, etc
    function sfenToPieceCode (piece) {
        // if promoted, put promotion sign in front
        if (piece.length === 2) {
            piece = piece[1] + piece[0];
        }

        // white piece
        if (piece.toLowerCase() === piece) {
            return 'w' + piece.toUpperCase();
        }

        // black piece
        return 'b' + piece;
    }

    // convert bP, wK, etc code to SFEN structure
    function pieceCodetoSfen (piece) {
        let pieceCodeLetters = piece.split('');
        let promoted = pieceCodeLetters[2] || "";

        // white piece
        if (pieceCodeLetters[0] === 'b') {
            return promoted + pieceCodeLetters[1].toUpperCase();
        }  

        // black piece
        return promoted + pieceCodeLetters[1].toLowerCase();
    }

    // convert SFEN string to position object
    // returns false if the SFEN is invalid
    function sfenToObj (sfen) {
        if (!validSfen(sfen)) return false;

        sfen = sfen.split(' ');
        // get board object -------------------------------------------------
        let ranks = sfen[0].split('/');
        let position = {};

        let rankIdx = 8;
        for (let i = 0; i < 9; i++) {
            let rank = ranks[i].split('');

            let colIdx = 0;
            // loop through each character in the board section
            for (let j = 0; j < rank.length; j++) {
                // number (empty squares)
                if (rank[j].search(/[1-9]/) !== -1) {
                    let numEmptySquares = parseInt(rank[j], 10);
                    colIdx = colIdx + numEmptySquares;
                } else {
                    // piece, check if promoted
                    let promoted = '';
                    if (rank[j] === '+'){
                        promoted = '+';
                        j++;
                    }

                    let square = FILES[colIdx] + RANKS[rankIdx];
                    position[square] = sfenToPieceCode(promoted + rank[j]);
                    colIdx++;
                }
            }
            rankIdx--;
        }
        // ------------------------------------------------------------------

        // get hands object -------------------------------------------------
        // initialize objects
        let pieces = 'RBGSNLP'.split('');
        /* for (let i = 0; i < pieces.length; i++) {
            position['bh' + pieces[i]] = 0; // black hand
            position['wh' + pieces[i]] = 0; // white hand
        } */

        if (sfen[2] !== '-') {
            let res = HAND_REGEX.exec(sfen[2]);

            for (let i = 1; i < res.length; i++) {
                if(typeof res[i] === "undefined")
                    continue;

                let type = res[i][res[i].length - 1];
                let qtt = res[i].length > 1 ? parseInt(res[i], 10) : 1;
                let handSquare = type.toUpperCase() === type ? ('bh' + type) : ('wh' + type.toUpperCase());
                
                position[handSquare] = qtt;
            }
        }

        return position;
    }

    // position object to SFEN string
    // returns false if the obj is not a valid position object
    function objToSfen (obj) {
        if (!validPositionObject(obj)) return false;

        // Board string ---------------------------------------------
        let board = '';
        let rankIdx = 8;
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                let square = FILES[j] + RANKS[rankIdx];

                // piece exists
                if (obj.hasOwnProperty(square)) {
                    board = board + pieceCodetoSfen(obj[square]);
                } else {
                    // empty space
                    board = board + '1';
                }
            }

            if (i !== 8) {
                board = board + '/';
            }

            rankIdx = rankIdx - 1;
        }

        // squeeze the empty numbers together
        board = squeezeSfenEmptySquares(board);
        // ----------------------------------------------------------

        // Hands string ---------------------------------------------
        let hand = '';

        // black pieces
        for (let i = 0; i < HAND_PIECES_ORDER.length; i++) {
            let piece = HAND_PIECES_ORDER[i];
            let qtt = obj['bh' + piece.toUpperCase()];

            if (qtt > 0) {
                if (qtt > 1) {
                    hand += qtt.toString(); 
                }

                hand += piece.toUpperCase();
            }
        }

        // white pieces
        for (let i = 0; i < HAND_PIECES_ORDER.length; i++) {
            let piece = HAND_PIECES_ORDER[i];
            let qtt = obj['wh' + piece.toUpperCase()];

            if (qtt > 0) {
                if (qtt > 1) {
                    hand += qtt.toString(); 
                }

                hand += piece.toLowerCase();
            }
        }

        if (hand === '') hand = '-';
        // ----------------------------------------------------------

        return [board, '-', hand, '-'].join(' ');
    }

    function squeezeSfenEmptySquares (sfen) {
        return sfen.replace(/111111111/g, '9')
            .replace(/11111111/g, '8')
            .replace(/1111111/g, '7')
            .replace(/111111/g, '6')
            .replace(/11111/g, '5')
            .replace(/1111/g, '4')
            .replace(/111/g, '3')
            .replace(/11/g, '2');
    }

    function expandSfenEmptySquares (sfen) {
		return sfen.replace(/9/g, '111111111')
			.replace(/8/g, '11111111')
			.replace(/7/g, '1111111')
			.replace(/6/g, '111111')
			.replace(/5/g, '11111')
			.replace(/4/g, '1111')
			.replace(/3/g, '111')
			.replace(/2/g, '11');
    }
    
    	// returns the distance between two squares
	function squareDistance (squareA, squareB) {
		let squareAArray = squareA.split('');
		let squareAx = FILES.indexOf(squareAArray[0]) + 1;
		let squareAy = RANKS.indexOf(squareAArray[1]) + 1;

		let squareBArray = squareB.split('');
		let squareBx = FILES.indexOf(squareBArray[0]) + 1;
		let squareBy = RANKS.indexOf(squareBArray[1]) + 1;

		let xDelta = Math.abs(squareAx - squareBx);
		let yDelta = Math.abs(squareAy - squareBy);

		if (xDelta >= yDelta) return xDelta;
		return yDelta;
    }
    
    	// returns the square of the closest instance of piece
	// returns false if no instance of piece is found in position
	function findClosestPiece (position, piece, square) {
		// create array of closest squares from square
		let closestSquares = createRadius(square);

		// search through the position in order of distance for the piece
		for (let i = 0; i < closestSquares.length; i++) {
			let s = closestSquares[i];

			if (position.hasOwnProperty(s) && position[s] === piece) {
				return s;
			}
		}

		return false;
    }
    
    	// returns an array of closest squares from square
	function createRadius (square) {
		let squares = [];

		// calculate distance of all squares
		for (let i = 0; i < 8; i++) {
			for (let j = 0; j < 8; j++) {
				let s = FILES[i] + RANKS[j];

				// skip the square we're starting from
				if (square === s) continue;

				squares.push({
					square: s,
					distance: squareDistance(square, s)
				});
			}
		}

		// sort by distance
		squares.sort(function (a, b) {
			return a.distance - b.distance;
		});

		// just return the square code
		let surroundingSquares = [];
		for (i = 0; i < squares.length; i++) {
			surroundingSquares.push(squares[i].square);
		}

		return surroundingSquares;
    }
    
    // given a position and a set of moves, return a new position
    // with the moves executed
    function calculatePositionFromMoves (position, moves) {
        let newPosition = deepCopy(position);

        for (let i in moves) {
            if (!moves.hasOwnProperty(i)) continue;

            // skip the move if the position doesn't have a piece on the source square
            if (!newPosition.hasOwnProperty(i)) continue;
            
            let piece = ''
            if (validBoardSquare(i)) {
                piece = newPosition[i];
                delete newPosition[i];
            } else {
                piece = i[0] + i[2];
                newPosition[i]--;
            }

            newPosition[moves[i]] = piece;            
        }

        return newPosition;
    }

	// ---------------------------------------------------------------------------
	// HTML
	// ---------------------------------------------------------------------------

    function buildContainerHTML (hasSparePieces) {
        let html = '<div>';

        if (hasSparePieces) {
			html += '<div class="{sparePieces} {sparePiecesTop}"></div>';
		}

        html += '<div class="{handBoard} {left}"></div>'
        html += '<div class="{boardBox}"></div>';
		html += '<div class="{handBoard} {right}"></div>'


        if (hasSparePieces) {
			html += '<div class="{sparePieces} {sparePiecesBottom}"></div>';
        }

        html += '</div>';

        
        return interpolateTemplate(html, CSS);
    }

    // ---------------------------------------------------------------------------
	// Config
	// ---------------------------------------------------------------------------

	function expandConfigArgumentShorthand (config) {
		if (config === 'start') {
			config = {position: deepCopy(START_POSITION)};
		} else if (validSfen(config)) {
			config = {position: sfenToObj(config)};
		} else if (validPositionObject(config)) {
			config = {position: deepCopy(config)};
		}

		// config must be an object
		if (!$.isPlainObject(config)) config = {};

		return config;
	}

	// validate config / set default options
	function expandConfig (config) {
		// default for orientation is white
		if (config.orientation !== 'white') config.orientation = 'black';

		// default for showNotation is true
		if (config.showNotation !== false) config.showNotation = true;

		// default for draggable is false
		if (config.draggable !== true) config.draggable = false;

		// default for dropOffBoard is 'trash'
		if (config.dropOffBoard !== 'snapback') config.dropOffBoard = 'trash';

		// default for sparePieces is true
		if (config.sparePieces !== false) config.sparePieces = true;

		// draggable must be true if sparePieces is enabled
		if (config.sparePieces) config.draggable = true;

		// default for showing dots is true
		if (config.showDots !== false) config.showDots = true;

		// default piece theme is wikipedia
		if (!config.hasOwnProperty('pieceTheme') ||
				(!isString(config.pieceTheme) && !isFunction(config.pieceTheme))) {
			config.pieceTheme = 'img/shogipieces/{orientation}/{piece}.svg';
		}

		// animation speeds
		if (!validAnimationSpeed(config.appearSpeed)) config.appearSpeed = DEFAULT_APPEAR_SPEED;
		if (!validAnimationSpeed(config.moveSpeed)) config.moveSpeed = DEFAULT_MOVE_SPEED;
		if (!validAnimationSpeed(config.snapbackSpeed)) config.snapbackSpeed = DEFAULT_SNAPBACK_SPEED;
		if (!validAnimationSpeed(config.snapSpeed)) config.snapSpeed = DEFAULT_SNAP_SPEED;
		if (!validAnimationSpeed(config.trashSpeed)) config.trashSpeed = DEFAULT_TRASH_SPEED;

		// throttle rate
		if (!validThrottleRate(config.dragThrottleRate)) config.dragThrottleRate = DEFAULT_DRAG_THROTTLE_RATE;

		return config;
	}

    // ---------------------------------------------------------------------------
    // Dependencies
    // ---------------------------------------------------------------------------

    // check for a compatible version of jQuery
    function checkJQuery () {
        if (!validJQueryVersion()) {
            let errorMsg = 'Shogiboard Error 1005: Unable to find a valid version of jQuery. ' +
                'Please include jQuery ' + MINIMUM_JQUERY_VERSION + ' or higher on the page' +
                '\n\n' +
                'Exiting' + ELLIPSIS;
            window.alert(errorMsg);
            return false;
        }

        return true;
    }

    // return either boolean false or the $container element
    function checkContainerArg (containerElOrString) {
        if (containerElOrString === '') {
            let errorMsg1 = 'Shogiboard Error 1001: ' +
                'The first argument to Shogiboard() cannot be an empty string.' +
                '\n\n' +
                'Exiting' + ELLIPSIS;
            window.alert(errorMsg1);
            return false;
        }

        // convert containerEl to query selector if it is a string
        if (isString(containerElOrString) &&
                containerElOrString.charAt(0) !== '#') {
            containerElOrString = '#' + containerElOrString;
        }

        // containerEl must be something that becomes a jQuery collection of size 1
        let $container = $(containerElOrString);
        if ($container.length !== 1) {
            let errorMsg2 = 'Shogiboard Error 1003: ' +
                'The first argument to Shogiboard() must be the ID of a DOM node, ' +
                'an ID query selector, or a single DOM node.' +
                '\n\n' +
                'Exiting' + ELLIPSIS;
            window.alert(errorMsg2);
            return false;
        }

        return $container;
    }

    // ---------------------------------------------------------------------------
	// Constructor
    // ---------------------------------------------------------------------------
    
    function constructor (containerElOrString, config) {
        // first things first: check basic dependencies
        if (!checkJQuery()) return null;
        let $container = checkContainerArg(containerElOrString);
        if (!$container) return null;

        // ensure the config object is what we expect
		config = expandConfigArgumentShorthand(config);
		config = expandConfig(config);

        // DOM elements
        let $boardBox = null;
        let $leftBoard = null;
        let $rightBoard = null;
        let $draggedPiece = null;
		let $sparePiecesTop = null;
		let $sparePiecesBottom = null;

        // constructor return object
        let widget = {};

        // -------------------------------------------------------------------------
        // Stateful
        // -------------------------------------------------------------------------

        let currentOrientation = 'black';
        let squareWidth = 0;
        let fontSize = 0;
        let squareHeight = 0;
        let sparePiecesElsIds = {};
		let squareElsIds = {};
		let squareElsOffsets = {};
        let currentPosition = {};
        let draggedPiece = null;
        let draggedPieceLocation = null;
        let draggedPieceSource = null;
        let isDragging = false;        
        
        // -------------------------------------------------------------------------
        // PROPORTIONS
        // -------------------------------------------------------------------------

        const SQUARE_PROPORTION = 1.1;
        const RELATIVE_BOARD_WIDTH = 0.66; 
        const RELATIVE_PADDING_SIZE = 0.021; 
        const RELATIVE_HBOARD_WIDTH = 0.12; 
        const RELATIVE_FONT_SIZE = 0.018;
        const RELATIVE_BORDER_SIZE = 0.002;
        const RELATIVE_DOT_RADIUS = 0.0035;

		// -------------------------------------------------------------------------
		// Validation / Errors
		// -------------------------------------------------------------------------

        function error (code, msg, obj) {
			// do nothing if showErrors is not set
			if (config.hasOwnProperty('showErrors') !== true ||
					config.showErrors === false) {
				return;
			}

			let errorText = 'Shogiboard Error ' + code + ': ' + msg;

			// print to console
			if (config.showErrors === 'console' &&
					typeof console === 'object' &&
					typeof console.log === 'function') {
				console.log(errorText);
				if (arguments.length >= 2) {
					console.log(obj);
				}
				return;
			}

				// alert errors
			if (config.showErrors === 'alert') {
				if (obj) {
					errorText += '\n\n' + JSON.stringify(obj);
				}
				window.alert(errorText);
				return;
			}

			// custom function
			if (isFunction(config.showErrors)) {
				config.showErrors(code, msg, obj);
			}
        }
        
        function setInitialState () {
			currentOrientation = config.orientation;

			// make sure position is valid
			if (config.hasOwnProperty('position')) {
				if (config.position === 'start') {
					currentPosition = deepCopy(START_POSITION);
				} else if (validSfen(config.position)) {
					currentPosition = sfenToObj(config.position);
				} else if (validPositionObject(config.position)) {
					currentPosition = deepCopy(config.position);
				} else {
					error(7263,
						'Invalid value passed to config.position.',
						config.position
					);
				}
			}
        }
        
        // -------------------------------------------------------------------------
		// DOM Misc
        // -------------------------------------------------------------------------

        function calculateSquareWidth (containerWidth) {
            // defensive, prevent infinite loop
            if (!containerWidth || containerWidth <= 0) {
                return 0;
            }

            // pad one pixel
            let boardWidth = Math.floor(RELATIVE_BOARD_WIDTH * containerWidth);

            while (boardWidth % 9 !== 0 && boardWidth > 0) {
                boardWidth = boardWidth - 1;
            }

            return boardWidth / 9;
        }

        // create random IDs for elements
		function createElIds () {
			// squares on the board
			for (let i = 0; i < FILES.length; i++) {
				for (let j = 0; j < RANKS.length; j++) {
					let square = FILES[i] + RANKS[j];
					squareElsIds[square] = square + '-' + uuid();
				}
			}

			// spare pieces
			let pieces = 'KRBGSNLP'.split('');
			for (i = 0; i < pieces.length; i++) {
				let whitePiece = 'w' + pieces[i];
				let blackPiece = 'b' + pieces[i];
				sparePiecesElsIds[whitePiece] = whitePiece + '-' + uuid();
				sparePiecesElsIds[blackPiece] = blackPiece + '-' + uuid();
			}

			//hand squares
			let handPieces = 'PLNSGBR'.split('');
			for (i = 0; i < handPieces.length; i++) {
				let whiteHand = 'wh' + handPieces[i];
				let blackHand = 'bh' + handPieces[i];
				squareElsIds[whiteHand] = whiteHand + '-' + uuid();
				squareElsIds[blackHand] = blackHand + '-' + uuid();
            }
		}

        // -------------------------------------------------------------------------
		// Markup Building
		// -------------------------------------------------------------------------

        function buildHandBoardHTML (side, orientation) {
            if (orientation !== 'black') {
                orientation = 'white';
            }

            if (side !== 'left' && side !== 'right') {
                throw "Undefined side for hand board creation."
            }

            let pieces = (side === 'left') ? 'PLNSGBR' : 'RBGSNLP';
            let color = orientation === 'black' ?
                            (side === 'left' ? 'w' : 'b') :
                            (side === 'left' ? 'b' : 'w');    

            let html = '';
            for (let i = 0; i < 7; i++)
            {
                let square = color + 'h' + pieces[i];

                html += '<div class="{square} ' +
						'square-' + square + '" ' +
						'style="width:' + squareWidth + 'px;' +
						'height:' + squareHeight + 'px;" ' +
						'id="' + squareElsIds[square] + '" ' +
						'data-square="' + square + '">';

				html += '</div>'
            }

            return interpolateTemplate(html, CSS);
        }

        function buildBoardHTML (orientation) {
            if (orientation !== 'black') {
                orientation = 'white';
            }

            let html = '<div class="{board}">';

            // algebraic notation / orientation
            let files = deepCopy(FILES);
            let row = 8;
            if (orientation === 'white') {
                files.reverse();
                row = 0;
            }
            let startRow = row;

            for (let i = 0; i < 9; i++) {
                html += '<div>';
                for (let j = 0; j < 9; j++) {
                    let square = files[j] + RANKS[row];

                    html += '<div class="{square} ' +
                        'square-' + square + '" ' +
                        'style="width:' + squareWidth + 'px;' +
                        'height:' + squareHeight + 'px;" ' +
						'id="' + squareElsIds[square] + '" ' +
                        'data-square="' + square + '">';

                    // show notation
                    if (config.showNotation) {
                        // files notation
                        if ((orientation === 'black' && row === 8) ||
                                (orientation === 'white' && row === 0)) {
                            html += '<div class="{notation} {files}">' + files[j] + '</div>';
                        }

                        // numeric notation
                        if (j === 8) {
                            html += '<div class="{notation} {ranks}">' + RANKS[row] + '</div>';
                        }
                    }

                    // show dots
                    if (config.showDots && ( 
                        Math.abs(row - startRow) === 3 && (j === 3 || j === 6) ||
                        Math.abs(row - startRow) === 6 && (j === 3 || j === 6))) {
                        html += '<div class="{dots}"></div>'
                    }

                    html += '</div>'; // end .square
                }
                html += '<div class="{clearfix}"></div></div>';

                if (orientation === 'black') {
                    row = row - 1;
                } else {
                    row = row + 1;
                }
            }
            html += '</div>';

            return interpolateTemplate(html, CSS);
        }

        function buildPieceImgSrc (piece) {
            if (isFunction(config.pieceTheme)) {
                return config.pieceTheme(piece, currentOrientation === 'white'); // pieceTheme(piece string, isFlipped)
            }

            if (isString(config.pieceTheme)) {
                return interpolateTemplate(
                    config.pieceTheme, 
                    {
                        piece: piece, 
                        orientation: (currentOrientation === 'black' ? 'normal' : 'flipped')
                    });
            }

            // NOTE: this should never happen
            error(8272, 'Unable to build image source for config.pieceTheme.');
            return '';
        }

        function buildPieceHTML (piece, hidden, id, proportion = 0.9) {
			let html = '<img src="' + buildPieceImgSrc(piece) + '" ';
			if (isString(id) && id !== '') {
				html += 'id="' + id + '" ';
            }
            
			html += 'alt="" ' +
				'class="{piece} "' + // (currentOrientation === 'white' ? 'flipped" ' : '"') +
				'data-piece="' + piece + '" ' +
				'style="width:' + Math.floor(proportion*squareWidth) + 'px;' + 'height:' + Math.floor(proportion*squareHeight) + 'px;';

			if (hidden) {
				html += 'display:none;';
			}

			html += '" />';

			return interpolateTemplate(html, CSS);
        }
        
        function buildSparePiecesHTML (color) {
			let pieces;
			if (color === 'black') {
				pieces = ['bK', 'bR', 'bB', 'bG', 'bS', 'bN', 'bL', 'bP', 'bR+', 'bB+', 'bS+', 'bN+', 'bL+', 'bP+'];
			} else {
				pieces = ['wK', 'wR', 'wB', 'wG', 'wS', 'wN', 'wL', 'wP', 'wR+', 'wB+', 'wS+', 'wN+', 'wL+', 'wP+'];
			}

			let html = '';
			for (let i = 0; i < pieces.length; i++) {
				html += buildPieceHTML(pieces[i], false, sparePiecesElsIds[pieces[i]], 0.84);
			}

			return html;
		}

		// -------------------------------------------------------------------------
		// Animations
        // -------------------------------------------------------------------------
        
        // TODO - include case when square is handSquare
        function animateSquareToSquare (src, dest, piece, completeFn) {
            // get information about the source and destination squares
            let $srcSquare = $('#' + squareElsIds[src]);
            let srcSquarePosition = $srcSquare.offset();
            let $destSquare = $('#' + squareElsIds[dest]);
            let destSquarePosition = $destSquare.offset();

            // create the animated piece and absolutely position it
            // over the source square
            let animatedPieceId = uuid();
            $('body').append(buildPieceHTML(piece, true, animatedPieceId));
            let $animatedPiece = $('#' + animatedPieceId);
            $animatedPiece.css({
                display: '',
                position: 'absolute',
                top: srcSquarePosition.top,
                left: srcSquarePosition.left
            });

            // remove origina piece from source square
            $srcSquare.find('.' + CSS.piece).remove();

            function onFinishAnimation1 () {
                // add the "real" piece to the destination square
                $destSquare.append(buildPieceHTML(piece));

                // remove the animated piece
                $animatedPiece.remove();

                // run complete function
                if (isFunction(completeFn)) {
                    completeFn();
                }
            }

            // animate the piece to the destination square
            let opts = {
                duration: config.moveSpeed,
                complete: onFinishAnimation1
            };
            $animatedPiece.animate(destSquarePosition, opts);
        }

        function animateSparePieceToSquare (piece, dest, completeFn) {
            let srcOffset = $('#' + sparePiecesElsIds[piece]).offset();
            let $destSquare = $('#' + squareElsIds[dest]);
            let destOffset = $destSquare.offset();

            // create the animate piece
            let pieceId = uuid();
            $('body').append(buildPieceHTML(piece, true, pieceId));
            let $animatedPiece = $('#' + pieceId);
            $animatedPiece.css({
                display: '',
                position: 'absolute',
                left: srcOffset.left,
                top: srcOffset.top
            });

            // on complete
            function onFinishAnimation2 () {
                // add the "real" piece to the destination square
                $destSquare.find('.' + CSS.piece).remove();
                $destSquare.append(buildPieceHTML(piece));

                // remove the animated piece
                $animatedPiece.remove();

                // run complete function
                if (isFunction(completeFn)) {
                    completeFn();
                }
            }

            // animate the piece to the destination square
            let opts = {
                duration: config.moveSpeed,
                complete: onFinishAnimation2
            };
            $animatedPiece.animate(destOffset, opts);
        }

        // execute an array of animations
        function doAnimations (animations, oldPos, newPos) {
            if (animations.length === 0) return;

            let numFinished = 0;
            function onFinishAnimation3 () {
                // exit if all the animations aren't finished
                numFinished = numFinished + 1;
                if (numFinished !== animations.length) return;

                drawPositionInstant();

                // run their onMoveEnd funtion
                if (isFunction(config.onMoveEnd)) {
                    config.onMoveEnd(deepCopy(oldPos), deepCopy(newPos));
                }
            }

            for (let i = 0; i < animations.length; i++) {
                let animation = animations[i];

                // clear a piece
                if (animation.type === 'clear') {
                    $('#' + squareElsIds[animation.square] + ' .' + CSS.piece)
                        .fadeOut(config.trashSpeed, onFinishAnimation3);
                
                // add a piece with no spare pieces - fade the piece onto the square
                } else if (animation.type === 'add' && !config.sparePieces) {
                    $('#' + squareElsIds[animation.square])
                        .append(buildPieceHTML(animation.piece, true))
                        .find('.' + CSS.piece)
                        .fadeIn(config.appearSpeed, onFinishAnimation3);

                // add a piece with spare pieces - animate from the spares
                } else if (animation.type === 'add' && config.sparePieces) {
                    animateSparePieceToSquare(animation.piece, animation.square, onFinishAnimation3);

                // move a piece from squareA to squareB
                } else if (animation.type === 'move') {
                    animateSquareToSquare(animation.source, animation.destination, animation.piece, onFinishAnimation3);
                }
            }
        }

        // calculate an array of animations that need to happen in order to get
        // from pos1 to pos2
        function calculateAnimations (pos1, pos2) {
            // makes copies of both
            pos1 = deepCopy(pos1);
            pos2 = deepCopy(pos2);

            let animations = [];
            let squaresMovedTo = {};

            // remove pieces that are the same in both positions
            for (let i in pos2) {
                if (!pos2.hasOwnProperty(i)) continue;

                if (pos1.hasOwnProperty(i)) {
                    if (validHandSquare(i)) {
                        if ((pos1[i] > 0 && pos2[i] > 0) || 
                            (pos1[i] === 0 && pos2[i] === 0)) {
                            
                            delete pos1[i];
                            delete pos2[i];
                        }

                    } else if (pos1[i] === pos2[i]) {
                        delete pos1[i];
                        delete pos2[i];
                    }
                }
            }

            // find all the "move" animations
            for (let i in pos2) {
                if (!pos2.hasOwnProperty(i) || validHandSquare(i)) continue;

                let closestPiece = findClosestPiece(pos1, pos2[i], i);
                if (closestPiece) {
                    animations.push({
                        type: 'move',
                        source: closestPiece,
                        destination: i,
                        piece: pos2[i]
                    });

                    delete pos1[closestPiece];
                    delete pos2[i];
                    squaresMovedTo[i] = true;
                }
            }

            // "add" animations
            for (let i in pos2) {
                if (!pos2.hasOwnProperty(i) || pos2[i] === 0) continue;
                
                let piece = validHandSquare(i) ? (i[0] + i[2]) : pos2[i];
                animations.push({
                    type: 'add',
                    square: i,
                    piece: piece
                });

                delete pos2[i];
            }

            // "clear" animations
            for (let i in pos1) {
                if (!pos1.hasOwnProperty(i)) continue;

                // do not clear a piece if it is on a square that is the result
                // of a "move"
                if (squaresMovedTo.hasOwnProperty(i)) continue;

                let piece = validHandSquare(i) ? (i[0] + i[2]) : pos1[i];
                animations.push({
                    type: 'clear',
                    square: i,
                    piece: piece
                });

                delete pos1[i];
            }

            return animations;
        }

		// -------------------------------------------------------------------------
		// Control Flow
		// -------------------------------------------------------------------------

		function drawPositionInstant () {
			// clear the board
            $boardBox.find('.' + CSS.piece).remove();
            $container.find('.' + CSS.handBoard).find('.' + CSS.piece).remove();
            $container.find('.' + CSS.handBoard).find('.' + CSS.numbers).remove();

			// add the pieces
			for (let i in currentPosition) {
                if (!currentPosition.hasOwnProperty(i)) continue;
                
                if (validBoardSquare(i)) {
                    $('#' + squareElsIds[i]).append(buildPieceHTML(currentPosition[i]));
                }
                else if (isInteger(currentPosition[i]) && currentPosition[i] > 0) { // Hand square
                    // draw piece
                    $('#' + squareElsIds[i]).append(
                        interpolateTemplate('<div class="{notation} {numbers}" style = "font-size:' + fontSize + 'px;">' + currentPosition[i] + '</div>', CSS));
                    $('#' + squareElsIds[i]).append(buildPieceHTML(i[0] + i[2]));
                }
			}
        }
        
        function drawBoard () {
            $boardBox.html(buildBoardHTML(currentOrientation));
            $leftBoard.html(buildHandBoardHTML('left', currentOrientation));
            $rightBoard.html(buildHandBoardHTML('right', currentOrientation));

            drawPositionInstant();

            if (config.sparePieces) {
				if (currentOrientation === 'black') {
					$sparePiecesTop.html(buildSparePiecesHTML('white'));
					$sparePiecesBottom.html(buildSparePiecesHTML('black'));
				} else {
					$sparePiecesTop.html(buildSparePiecesHTML('black'));
					$sparePiecesBottom.html(buildSparePiecesHTML('white'));
				}
			}
        }

        function setCurrentPosition (position) {
			let oldPos = deepCopy(currentPosition);
			let newPos = deepCopy(position);
			let oldSfen = objToSfen(oldPos);
			let newSfen = objToSfen(newPos);

			// do nothing if no change in position
			if (oldSfen === newSfen) return;

			// run their onChange function
			if (isFunction(config.onChange)) {
				config.onChange(oldPos, newPos);
			}

			// update state
			currentPosition = position;
        }
        
        function isXYOnSquare (x, y) {
			for (let i in squareElsOffsets) {
				if (!squareElsOffsets.hasOwnProperty(i)) continue;

                let s = squareElsOffsets[i]
				if (x >= s.left &&
					x < s.left + squareWidth &&
					y >= s.top &&
					y < s.top + squareHeight) {
					return i;
				}
			}

			return 'offboard';
		}

        // records the XY coords of every square into memory
		function captureSquareOffsets () {
			squareElsOffsets = {}

			for (let i in squareElsIds) {
				if (!squareElsIds.hasOwnProperty(i)) continue;

				squareElsOffsets[i] = $('#' + squareElsIds[i]).offset();
			}
        }
        
        function removeSquareHighlights () {
			$boardBox.find('.' + CSS.square)
				.removeClass(CSS.highlight1 + ' ' + CSS.highlight2);
        }
        
        function snapbackDraggedPiece () {
            // there is no "snapback" for spare pieces
            if (draggedPieceSource === 'spare') {
                trashDraggedPiece();
                return;
            }

            removeSquareHighlights();

            // animation complete
            function complete () {
                drawPositionInstant();
                $draggedPiece.css('display', 'none');

                // run their onSnapbackEnd function
                if (isFunction(config.onSnapbackEnd)) {
                    config.onSnapbackEnd(
                        draggedPiece,
                        draggedPieceSource,
                        deepCopy(currentPosition),
                        currentOrientation
                    );
                }
            }

            // get source square position
            let sourceSquarePosition = $('#' + squareElsIds[draggedPieceSource]).offset();

            // animate the piece to the target square
            let opts = {
                duration: config.snapbackSpeed,
                complete: complete
            };
            $draggedPiece.animate(sourceSquarePosition, opts);

            // set state
            isDragging = false;
        }

        function trashDraggedPiece () {
            removeSquareHighlights();

            // remove the source piece
            let newPosition = deepCopy(currentPosition);
            delete newPosition[draggedPieceSource];
            setCurrentPosition(newPosition);

            // redraw the positions
            drawPositionInstant();

            // hide the dragged piece
            $draggedPiece.fadeOut(config.trashSpeed);

            // set state
            isDragging = false;
        }

        function dropDraggedPieceOnSquare (square) {
            removeSquareHighlights();

            // Cannot drop a piece on hand square
            if (validHandSquare(square)) {
                snapbackDraggedPiece();
                return;
            }

            // update position
            newPosition = deepCopy(currentPosition);
            
            if (validHandSquare(draggedPieceSource))
                newPosition[draggedPieceSource]--;
            else // it's a hand board square
                delete newPosition[draggedPieceSource];

            newPosition[square] = draggedPiece;
            setCurrentPosition(newPosition);

            // get target square information
            let targetSquarePosition = $('#' + squareElsIds[square]).offset();

            // animation complete
            function onAnimationComplete () {
                drawPositionInstant();
                $draggedPiece.css('display', 'none');

                // execute their onSnapEnd function
                if (isFunction(config.onSnapEnd)) {
                    config.onSnapEnd(draggedPieceSource, square, draggedPiece);
                }
            } 

            // snap the piece to the target square
            let opts = {
                duration: config.snapSpeed,
                complete: onAnimationComplete
            };
            $draggedPiece.animate(targetSquarePosition, opts);

            // set state
            isDragging = false;            
        }

        function beginDraggingPiece (source, piece, x, y) {
            // run their custom OnDragStart function
            // their custom onDragStart function can cancel drag start
        
            if (isFunction(config.onDragStart) 
                && config.onDragStart(
                    source, 
                    piece, 
                    deepCopy(currentPosition), 
                    currentOrientation) === false) 
            {
                return;
            }

            // set space
            isDragging = true;
            draggedPiece = piece;
            draggedPieceSource = source;

            // if the piece came from spare pieces, location is offboard
            if (source === 'spare') {
                draggedPieceLocation = 'offboard';
            } else {
                draggedPieceLocation = source;
            }

            // capture the x, y, coords of all squares in memory
            captureSquareOffsets();

            // create the dragged piece
            $draggedPiece.attr('src', buildPieceImgSrc(piece)).css({
                display: '',
                position: 'absolute',
                left: x - squareWidth / 2,
                top: y - squareHeight / 2
            });

            // flip it if orientation is switched
            if (currentOrientation === 'white') {
                $draggedPiece.addClass('flipped');
            } else {
                $draggedPiece.removeClass('flipped');
            }

            // TO-DO - add special highligh for pieces from hand?

            // if source is spare the function is done
            if (source === 'spare') return;
            
            // hide original piece
            if (validBoardSquare(source)) {
                // highlight the source and hide the piece
                $('#' + squareElsIds[source])
                    .addClass(CSS.highlight1)
                    .find('.' + CSS.piece)
                    .css('display', 'none');
            } else {
                let $counter = $('#' + squareElsIds[source]).find('.' + CSS.numbers);
                let counter = parseInt($counter.html());
                counter--;

                if (counter <= 0) {
                    $counter.remove();
                    $('#' + squareElsIds[source]).find('.' + CSS.piece).remove();
                } else {
                    $counter.html(counter);                
                }
            }
        }

        function updateDraggedPiece (x, y) {
            // put the dragged piece over the mouse cursor
            $draggedPiece.css({
				left: x - squareWidth / 2,
				top: y - squareHeight / 2
            });
            
            // get location
            let location = isXYOnSquare(x, y); // square where mouse is now

            // do nothing if the location has not changed
            if (location === draggedPieceLocation) return;

            // remove the highlight from previous square
            if (validBoardSquare(draggedPieceLocation)) {
                $('#' + squareElsIds[draggedPieceLocation]).removeClass(CSS.highlight2);
            }

            // add highlight to new square
            if (validBoardSquare(location)) {
				$('#' + squareElsIds[location]).addClass(CSS.highlight2);
            }
            
            // run onDragMove
            if (isFunction(config.onDragMove)) {
                config.onDragMove(
                        location,
                        draggedPieceLocation,
                        draggedPieceSource,
                        draggedPiece,
                        deepCopy(currentPosition),
                        currentOrientation
                    );
            }

            // update state
            draggedPieceLocation = location;
        }

        function stopDraggedPiece (location) {
            // determine what the action should be
            let action = 'drop';
            if (location === 'offboard' && config.dropOffBoard === 'snapback') {
                action = 'snapback';
            }
            if (location === 'offboard' && config.dropOffBoard === 'trash') {
                action = 'trash';
            }

            // run their onDrop function, which can potentially change the drop action
            if (isFunction(config.onDrop)) {
                let newPosition = deepCopy(currentPosition);

                // source piece is a spare piece and position if off the board
                // if (draggedPieceSource === 'spare' && location === 'offboard') {...}
                // position has not changed; do nothing

                // source piece is a spare piece and position is on the board
                if (draggedPieceSource === 'spare' && validBoardSquare(location)) {
                    // add the piece to the board
                    newPosition[location] = draggedPiece;
                }

                // source piece was on the board and position is off the board
                if (validSquare(draggedPieceSource) && location === 'offboard') {
                    // remove the piece from the board
                    delete newPosition[draggedPieceSource];
                }

                // source piece was on the board and position is on the board
                if (validSquare(draggedPieceSource) && validBoardSquare(location)) {
                    // move the piece
                    delete newPosition[draggedPieceSource];
                    newPosition[location] = draggedPiece;
                }

                let oldPosition = deepCopy(currentPosition);

                let result = config.onDrop(
                        draggedPieceSource,
                        location,
                        draggedPiece,
                        newPosition,
                        oldPosition,
                        currentOrientation
                    );
                if (result === 'snapback' || result === 'trash') {
                    action = result;
                }
            }

            // do it
            if (action === 'snapback') {
                snapbackDraggedPiece();
            } else if (action === 'trash') {
                trashDraggedPiece();
            } else if (action === 'drop') {
                dropDraggedPieceOnSquare(location);
            }
        }

        function addToHand (color, piece) {
            if (HAND_PIECES_ORDER.indexOf(piece.toLowerCase()) === -1) return false;
            if (color !== 'black' && color !== 'white') return false;

            let square = color[0] + 'h' + piece.toUpperCase();

            // check if in current position
            if (!currentPosition.hasOwnProperty(square))    currentPosition[square] = 0;
            let addElements = currentPosition[square] === 0;

            // make increment
            currentPosition[square] += 1;

            // add piece and counter if > 0
            if (addElements) {
                $('#' + squareElsIds[square]).append(interpolateTemplate('<div class="{notation} {numbers}">' + currentPosition[square] + '</div>', CSS));
                $('#' + squareElsIds[square]).append(buildPieceHTML(square[0] + square[2]));
            } else {
                $('#' + squareElsIds[square]).find('.' + CSS.numbers).html(currentPosition[square]);
            }

            return true;
        }

        widget.addToHand = addToHand;

        function removeFromHand (color, piece) {
            if (HAND_PIECES_ORDER.indexOf(piece.toLowerCase()) === -1) return false;
            if (color !== 'black' && color !== 'white') return false;

            let square = color[0] + 'h' + piece.toUpperCase();
            if (!currentPosition.hasOwnProperty(square) || currentPosition[square] === 0) return false;

            // decrease counter
            currentPosition[square] -= 1;

            $counter = $('#' + squareElsIds[square]).find('.' + CSS.numbers);
            if (currentPosition[square] <= 0) {
                $counter.remove();
                $('#' + squareElsIds[square]).find('.' + CSS.piece).remove();
            } else {
                $counter.html(currentPosition[square]);
            }

            return true;
        }

        widget.removeFromHand = removeFromHand;

		// -------------------------------------------------------------------------
		// Public Methods
		// -------------------------------------------------------------------------

        widget.clear = function (useAnimation) {
            widget.position({}, useAnimation);
        }

        // remove the widget from the page
        widget.destroy = function () {
            // remove markup
            $container.html('');
            $draggedPiece.remove();

            // remove event handlers;
            $container.unbind();
        }

        // shorthand method to get the current SFEN
        widget.sfen = function () {
            return widget.position('sfen');
        }

        // flip orientation
        widget.flip = function () {
            return widget.orientation('flip');
        }

        // move pieces
        widget.move = function () {
            if (arguments.length === 0) return currentPosition;

            let useAnimation = true;

            // collect the mvoes into an object
            let moves = {}
            for (let i = 0; i < arguments.length; i++) {
                // any "false" to this function means no animations
                if (arguments[i] === false) {
                    useAnimation = false;
                    continue;
                }

                // skip invalid arguments
                if (!validMove(arguments[i])) {
                    error(2826, 'Invalid move passed to the move method.', arguments[i]);
                    continue;
                }

                let tmp = arguments[i].split('-');
                moves[tmp[0]] = tmp[1];
            }

            // calculate position from moves
            let newPos = calculatePositionFromMoves(currentPosition, moves);

            // update the board
            widget.position(newPos, useAnimation);

            // return the new position object
            return newPos;
        }

        widget.orientation = function (arg) {
            // no arguments, return the curren orientation
            if (arguments.length === 0) {
                return currentOrientation;
            }

            // set to white or black
            if (arg === 'white' || arg === 'black') {
                currentOrientation = arg;
                drawBoard();
                return currentOrientation;
            }

            // flip orientation
            if (arg === 'flip') {
                currentOrientation = currentOrientation === 'white' ? 'black' : 'white';
                drawBoard();
                return currentOrientation;
            }

            error(5482, 'Invalid value passed to the orientation method.', arg);
        }

        widget.position = function (position, useAnimation) {
            // no arguments, return the current position
            if (arguments.length === 0) {
                return currentPosition;
            }

            // get position as SFEN
            if (isString(position) && position.toLowerCase() === 'sfen') {
				return objToSfen(currentPosition);
            }
            
            // start position
			if (isString(position) && position.toLowerCase() === 'start') {
				position = deepCopy(START_POSITION);
            }
            
            // convert SFEN to position object
			if (validSfen(position)) {
				position = sfenToObj(position);
            }
            
            // validate position object
			if (!validPositionObject(position)) {
				error(6482, 'Invalid value passed to the position method.', position);
				return;
            }
            
            // default for useAnimations is true
            if (useAnimation !== false) useAnimation = true;
            
            if (useAnimation) {
				// start the animations
				let animations = calculateAnimations(currentPosition, position);
				doAnimations(animations, currentPosition, position);

				// set the new position
                setCurrentPosition(position);
				//drawPositionInstant();
			} else {
				// instant update
				setCurrentPosition(position);
				drawPositionInstant();
			}
        }

        widget.resize = function () {
            let containerWidth = parseInt($container.width(), 10);

            // calulate the new square dimensions ---------------------------------------
            squareWidth = calculateSquareWidth(containerWidth);
            squareHeight = Math.floor(squareWidth * SQUARE_PROPORTION);
            fontSize = Math.floor(containerWidth * RELATIVE_FONT_SIZE); 

            // redraw the board ---------------------------------------------------------
            drawBoard();

            // Dimensions ---------------------------------------------------------------
            let borderSize = Math.max(Math.floor(RELATIVE_BORDER_SIZE * containerWidth), 1);
            let dotRadius = Math.max(RELATIVE_DOT_RADIUS * containerWidth, 2.5);
            let boardWidth = squareWidth * 9;
            let boardPadding = Math.floor(RELATIVE_PADDING_SIZE * containerWidth);
            //let boardOutlineOffset = (-1) * (boardPadding + borderSize);
            let hBoardTotalWidth = Math.floor(RELATIVE_HBOARD_WIDTH * containerWidth);
			let boardMargin = Math.floor((containerWidth - 2 * hBoardTotalWidth - boardWidth - 2 * boardPadding) / 2);

            // set board dimensions -----------------------------------------------------
            $board = $boardBox.find('.' + CSS.board);
            $board.css('width', boardWidth + 'px');
            $board.css('border-width', 2*borderSize + 'px');

            $boardBox.css('padding', boardPadding + 'px');
            $boardBox.css('margin-left', boardMargin + 'px');

            // borders and dots
            $board.find('.' + CSS.square).css('border-right-width', borderSize + 'px');
            $board.find('.' + CSS.square).css('border-bottom-width', borderSize + 'px');
            $board.find('.' + CSS.dots).css('border-width', dotRadius + 'px');
            $board.find('.' + CSS.dots).css('top', (-1*(dotRadius + borderSize / 2)) + 'px');
            $board.find('.' + CSS.dots).css('left', (-1*(dotRadius + borderSize / 2)) + 'px');

            // set hand boards dimensions -----------------------------------------------
            $leftBoard.css('width', hBoardTotalWidth + 'px');
            $rightBoard.css('width', hBoardTotalWidth + 'px');

            let len1 = Math.floor((hBoardTotalWidth - squareWidth) / 3);
            let len2 = (hBoardTotalWidth - squareWidth - len1).toString() + 'px';
            let margin = 9 * squareHeight + 2 * boardPadding + 4*borderSize - 7 * squareHeight - 2 * len1;
            len1 = len1.toString() + 'px';

            $leftBoard.css('padding', [len1, len2, len1, len1].join(' '));
            $rightBoard.css('padding', [len1, len2, len1, len1].join(' '));
            $rightBoard.css('margin-top', margin + 'px');

            $('.' + CSS.notation).css('font-size', fontSize + 'px');

            // set drag piece size
			$draggedPiece.css({
				height: Math.floor(0.9*squareHeight),
				width: Math.floor(0.9*squareWidth)
			});

			// spare pieces
			if (config.sparePieces) {
				$container.find('.' + CSS.sparePieces)
					.css('paddingLeft', Math.floor((squareWidth + borderSize) / 2) + 'px')
					.css('paddingRight', Math.floor((squareWidth + borderSize) / 2) + 'px');
			}
        }

        // set the starting position
        widget.start = function (useAnimation) {
            widget.position('start', useAnimation);
        }

        // -------------------------------------------------------------------------
		// Browser Events
		// -------------------------------------------------------------------------

        function stopDefault (evt) {
            evt.preventDefault();
        }

        function mousedownSquare (evt) {
            // do nothing if we'ew not draggable
            if (!config.draggable) return;

            // do nothing if there is no piece on this square
            let square = $(this).attr('data-square');
            if (!validSquare(square)) return;
            if (!currentPosition.hasOwnProperty(square) || currentPosition[square] === 0) return;
            let piece = validBoardSquare(square) ? currentPosition[square] : (square[0] + square[2]);
            
            beginDraggingPiece(square, piece, evt.pageX, evt.pageY);
        }

        function touchstartSquare (e) {
            // do nothing if we're not draggable
            if (!config.draggable) return;

            // do nothing if there is no piece on this square
			let square = $(this).attr('data-square');
			if (!validSquare(square)) return;
            if (!currentPosition.hasOwnProperty(square)) return;
            let piece = validBoardSquare(square) ? currentPosition[square] : (square[0] + square[2]);
            
            e = e.originalEvent;
			beginDraggingPiece(
					square,
					piece,
					e.changedTouches[0].pageX,
					e.changedTouches[0].pageY
				);
        }

        function mousedownSparePiece (evt) {
            // do nothing if sparePieces is not enabled
            if (!config.sparePieces) return;

            let piece = $(this).attr('data-piece');

            beginDraggingPiece('spare', piece, evt.pageX, evt.pageY);
        }

        function touchstartSparePiece (e) {
			// do nothing if sparePieces is not enabled
			if (!config.sparePieces) return;

			let piece = $(this).attr('data-piece');

			e = e.originalEvent;
			beginDraggingPiece(
					'spare',
					piece,
					e.changedTouches[0].pageX,
					e.changedTouches[0].pageY
				);
        }
        
        function mousemoveWindow (evt) {
			if (isDragging) {
				updateDraggedPiece(evt.pageX, evt.pageY);
			}
		}

        let throttledMousemoveWindow = throttle(mousemoveWindow, config.dragThrottleRate);

        function touchmoveWindow (evt) {
			// do nothing if we are not dragging a piece
			if (!isDragging) return;

			// prevent screen from scrolling
			evt.preventDefault();

			let ct = evt.originalEvent.changedTouches;
			updateDraggedPiece(ct[0].pageX, ct[0].pageY);
        }
        
		let throttledTouchmoveWindow = throttle(touchmoveWindow, config.dragThrottleRate);

        function mouseupWindow (evt) {
			// do nothing if we are not dragging a piece
			if (!isDragging) return;

			// get the location
			let location = isXYOnSquare(evt.pageX, evt.pageY);

			stopDraggedPiece(location);
        }
        
        function touchendWindow (evt) {
			// do nothing if we are not dragging a piece
			if (!isDragging) return;

			// get the location
			let ct = evt.originalEvent.changedTouches;
			let location = isXYOnSquare(ct[0].pageX, ct[0].pageY);

			stopDraggedPiece(location);
        }
        
        function mouseenterSquare (evt) {
            // do not fire tis event if we are dragging a piece
            // NOTE; this shuld never happen, but it's a safeguard
            if (isDragging) return;

            // exit if they did not provide a onMouseoverSquare function
            if (!isFunction(config.onMouseoverSquare)) return;

            // get the square
            let square = $(evt.currentTarget).attr('data-square');

            // NOTE: this should never happen; defensive
            if (!validSquare(square)) return;

            // get the piece on this square
            let piece = false;
            if (currentPosition.hasOwnProperty(square)) {
                piece = validBoardSquare(square) ? currentPosition[square] : (square[0] + square[2]);
            }

            // execute their function
            config.onMouseoverSquare(square, piece, deepCopy(currentPosition), currentOrientation);
        }

        function mouseleaveSquare (evt) {
            // do not fire this event if we are dragging a piece
			// NOTE: this should never happen, but it's a safeguard
            if (isDragging) return;
            
            // exit if they did not provide an onMouseoutSquare function
            if (!isFunction(config.onMouseoutSquare)) return;
            
            // get the square
            let square = $(evt.currentTarget).attr('data-square');
            
            // NOTE: this should never happen; defensive
            if (!validSquare(square)) return;
            
            // get the piece on this square
            let piece = false;
            if (currentPosition.hasOwnProperty(square)) {
                piece = validBoardSquare(square) ? currentPosition[square] : (square[0] + square[2]);
            }

            // execute their function
			config.onMouseoutSquare(square, piece, deepCopy(currentPosition), currentOrientation);
        }

		// -------------------------------------------------------------------------
		// Initialization
		// -------------------------------------------------------------------------

        function addEvents() {
            let $window = $(window);
            $window.on('resize', widget.resize);
            
            // prevent "image drag"
			$('body').on('mousedown mousemove', '.' + CSS.piece, stopDefault);

			// mouse drag pieces
            $boardBox.on('mousedown', '.' + CSS.square, mousedownSquare);
            $leftBoard.on('mousedown', '.' + CSS.square, mousedownSquare);
            $rightBoard.on('mousedown', '.' + CSS.square, mousedownSquare);
			$container.on('mousedown', '.' + CSS.sparePieces + ' .' + CSS.piece, mousedownSparePiece);

			// mouse enter / leave square
			$boardBox.on('mouseenter', '.' + CSS.square, mouseenterSquare).on('mouseleave', '.' + CSS.square, mouseleaveSquare);
			$leftBoard.on('mouseenter', '.' + CSS.square, mouseenterSquare).on('mouseleave', '.' + CSS.square, mouseleaveSquare);
			$rightBoard.on('mouseenter', '.' + CSS.square, mouseenterSquare).on('mouseleave', '.' + CSS.square, mouseleaveSquare);

			// piece drag
			$window.on('mousemove', throttledMousemoveWindow).on('mouseup', mouseupWindow);

			// touch drag pieces
			if (isTouchDevice()) {
				$boardBox.on('touchstart', '.' + CSS.square, touchstartSquare);
				$leftBoard.on('touchstart', '.' + CSS.square, touchstartSquare);
				$rightBoard.on('touchstart', '.' + CSS.square, touchstartSquare);
				$container.on('touchstart', '.' + CSS.sparePieces + ' .' + CSS.piece, touchstartSparePiece);
				$window.on('touchmove', throttledTouchmoveWindow).on('touchend', touchendWindow);
			}
        }

        function initDOM () {
            // create unique IDs for all the elements we will create
            createElIds();
            
            // build board and save it in memory
            $container.html(buildContainerHTML(config.sparePieces));
            $boardBox = $container.find('.' + CSS.boardBox);
            $leftBoard = $container.find('.' + CSS.handBoard + '.' + CSS.left);
            $rightBoard = $container.find('.' + CSS.handBoard + '.' + CSS.right);

            if (config.sparePieces) {
				$sparePiecesTop = $container.find('.' + CSS.sparePiecesTop);
				$sparePiecesBottom = $container.find('.' + CSS.sparePiecesBottom);
			}

            // create the drag piece
			let draggedPieceId = uuid();
			$('body').append(buildPieceHTML('wP', true, draggedPieceId));
			$draggedPiece = $('#' + draggedPieceId);

			// TODO: need to remove this dragged piece element if the board is no
            // longer in the DOM
            
            // set the size and draw the board
            widget.resize();
        }

        // -------------------------------------------------------------------------
		// Initialization
		// -------------------------------------------------------------------------

        setInitialState();
        initDOM();
        addEvents();

        // return the widget object
        return widget;
    } // end constructor

    window['Shogiboard'] = constructor;
    window['Shogiboard']['sfenToObj'] = sfenToObj;
    window['Shogiboard']['objToSfen'] = objToSfen;
}) ();