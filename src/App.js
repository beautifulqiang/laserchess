import React, { useCallback, useRef, useState, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Line } from "react-konva";
import { isEmpty, flatMap } from "lodash";
import BoardLayer from "./components/BoardLayer";
import BoardPiece from "./components/BoardPiece";
import useWindowSize from "./hooks/useWindowSize";
import LogoPNG from "./assets/logo.png";
import BluePlayerProfile from "./assets/ui/blue-player-profile.png";
import RedPlayerProfile from "./assets/ui/red-player-profile.png";
import { useDispatch, useSelector } from "react-redux";
import { togglePlayerTurn, hideLaserBeam, setBoardType, playerMove, aiMove, toggleAI } from "./redux/slices/gameSlice";
import { LocationUtils } from "./models/Location";
import { SquareUtils } from "./models/Square";
import { MovementTypesEnum, PlayerTypesEnum } from "./models/Enums";
import Board from "./models/Board";



function App() {

	// The selected piece location (when a piece is selected ofc).
	const [selectedPieceLocation, setSelectedPieceLocation] = useState(null);

	// The stage width. This is dynamic, and changes on window resize.
	const [stageWidth, setStageWidth] = useState(700);

	const aiEnabled = useSelector(state => state.game.aiEnabled); // the current board squares setup notation
	const squares = useSelector(state => state.game.squares); // The current board squares
	const turn = useSelector(state => state.game.turn); // It's blue by default!
	const laserBeamPath = useSelector(state => state.game.laser.path); // So i can enable the laser after the player has moved.
	const laserIsTriggered = useSelector(state => state.game.laser.triggered); // So i can enable the laser after the player has moved.
	const status = useSelector(state => state.game.status); // Current game state
	const winner = useSelector(state => state.game.winner); // The winner of this match!

	const stagePiecesLayerRef = useRef(); // A reference to the stage, used to find BoardPieces afterwards.
	const stageContainerRef = useRef(); // A reference to the Div containing the stage
	const dispatch = useDispatch();



	/**
	 * Resizes the stage width to match the DIV parent.
	 * For page responsiveness.
	 * This function is called on the "resize" event of the window.
	 */
	const refreshBoardSize = () => {
		const width = stageContainerRef.current.offsetWidth;
		setStageWidth(width);
	};

	useEffect(() => {
		// Setup the board pieces.
		dispatch(setBoardType());

		// Handle stage responsiveness
		// take a look here https://developers.google.com/web/updates/2016/10/resizeobserver
		// for simplicity I will just listen window resize
		refreshBoardSize();
		window.addEventListener("resize", refreshBoardSize);

		return () => {
			// clear on unmount to prevent memory leak!
			window.removeEventListener("resize", refreshBoardSize);
		};
	}, [dispatch]);



	// Methods
	useEffect(() => {
		// Shows the laser path, after each move for the player on the move.
		// Automatically hides it after 2 sec.
		// ? Maybe add an option to define for how long the laser beam should be shown
		if (laserBeamPath.length) {
			setTimeout(() => {
				// hide
				dispatch(togglePlayerTurn());
				dispatch(hideLaserBeam());
			}, 500);
		}

	}, [dispatch, laserBeamPath]);


	useEffect(() => {
		if (turn === PlayerTypesEnum.RED && aiEnabled) {
			// ? Red's the AI
			setTimeout(() => {
				dispatch(aiMove());
			}, 500);
		}

	}, [turn, aiEnabled, dispatch]);


	const getBoardSize = useCallback(() => {
		return stageWidth;
	}, [stageWidth]);


	const getCellSize = useCallback(() => {
		return getBoardSize() / 10;
	}, [getBoardSize]);


	/**
	 * Gets the current board
	 * 
	 * @returns {Board} the board object for the current squares.
	 */
	const getCurrentBoard = useCallback(() => {
		const board = new Board({ squares });
		return board;

	}, [squares]);



	// Renderers
	/**
	 * Highlight possible moves location for the selected piece.
	 */
	const drawHighlight = useCallback(() => {
		// Check if a piece is selected
		if (!isEmpty(selectedPieceLocation)) {
			// Retrieve all possible moves for the selected piece
			const board = getCurrentBoard();
			const movesForSelectedPiece = board.getMovesForPieceAtLocation(selectedPieceLocation);

			// Create the highlight Konva Rect and Circles
			const highlights = [];
			const selectedPieceHighlight = (
				<Rect key="selectedPiece"
					stroke="#F8F32B"
					cornerRadius={8}
					listening={false}
					strokeWidth={2}
					lineCap="round"
					lineJoin="round"
					width={getCellSize()}
					height={getCellSize()}
					x={selectedPieceLocation.colIndex * getCellSize()}
					y={selectedPieceLocation.rowIndex * getCellSize()} />
			);
			const possibleMovesHighlights = movesForSelectedPiece.map(move => {
				return (
					<Circle key={`pm--${LocationUtils.toANString(move.destLocation)}`}
						fill="#1EFC1E9F"
						offsetX={-(getCellSize()) / 2}
						offsetY={-(getCellSize()) / 2}
						listening={false}
						width={getCellSize() / 2.5}
						height={getCellSize() / 2.5}
						stroke="#1EFC1E"
						strokeWidth={4}
						perfectDrawEnabled={false}
						x={(move.destLocation.colIndex * getCellSize())}
						y={(move.destLocation.rowIndex * getCellSize())} />
				);
			});

			highlights.push(selectedPieceHighlight);
			highlights.push(possibleMovesHighlights);
			return highlights;
		}

	}, [selectedPieceLocation, getCellSize, getCurrentBoard]);


	/**
	 * Draw the pieces given the current board!
	 */
	const drawBoardPieces = useCallback(() => {
		// flatten all rows into a single array
		const flattenedSquares = flatMap(squares);
		const squaresWithPieces = flattenedSquares.filter((square) => {
			// Filter out the squares with no pieces in it.
			// Because we are not drawing empty squares on the board (obviously!)
			return SquareUtils.hasPiece(square);
		});

		// Transform the Piece inside the square into Konva's BoardPiece
		return squaresWithPieces.map((square) => (
			<BoardPiece turn={turn}
				laserIsTriggered={laserIsTriggered}
				id={LocationUtils.toANString(square.location)}
				key={`${square.piece.imageName}--${LocationUtils.toANString(square.location)}`}
				squares={squares}
				square={square}
				onMove={(movement, srcPieceXY) => {
					// console.log("Movement made!", movement);
					// console.log("From board: ", board);

					// For Special move only, we need to animate the switch manually.
					// You can comment out this part of the code if you prefer reduced motion (no move animation)
					if (movement.type === MovementTypesEnum.SPECIAL) {
						// Grab the piece that is being switched with the Switch piece.
						const destPieceId = LocationUtils.toANString(movement.destLocation);
						const query = stagePiecesLayerRef.current.find(`#${destPieceId}`);
						const destPieceRaw = query[0];

						// And move it to where the Switch piece srcLocation (Because you are already dragging the Switch to the destLocation)
						destPieceRaw.to({
							x: srcPieceXY.x,
							y: srcPieceXY.y,
							duration: 0.332,
							easing: Konva.Easings.BackEaseOut
						});
					}

					// Perform the movement
					// - Only delay if the movement type is NORMAL or SPECIAL (bc there is some animation on these movement types). 
					//   No need to delay while rotating, cause its istant!
					// ? Add an option to disable animations.
					let delayed = !(movement.type === MovementTypesEnum.ROTATION_CLOCKWISE || movement.type === MovementTypesEnum.ROTATION_C_CLOCKWISE);
					if (delayed) {
						// Delay the state change so that the konva animation finishes.
						setTimeout(() => {
							dispatch(playerMove({ movement: movement.serialize() }));
						}, 332); // 332ms is the tween duration for every piece movement in the game.

					} else {
						dispatch(playerMove({ movement: movement.serialize() }));
					}
				}}

				onSelect={(srcLocation) => {
					setSelectedPieceLocation(srcLocation);
				}}
				gridSize={getCellSize()} />
		));
	}, [squares, turn, laserIsTriggered, dispatch, getCellSize]);



	const drawLaser = useCallback(() => {
		const points = flatMap(laserBeamPath).map(coord => coord * getCellSize() + (getCellSize() / 2));
		if (points) {
			return (
				<Line points={points}
					stroke="#FF7600"
					lineCap="round"
					lineJoin="round"
					listening={false}
					strokeWidth={7} />
			);
		}
	}, [laserBeamPath, getCellSize]);


	return (
		<div>
			<nav className="navbar navbar-dark bg-dark">
				<div className="container">
					<a className="navbar-brand" href="#">
						<img src={LogoPNG} alt="laser-chess.com logo" height="52" />
					</a>
				</div>
			</nav>

			<div className="container section">
				<div className="row align-items-center">
					<div className="col-12 col-lg-6">
						<div>
							<div className="text-white py-3">
								<div className="row align-items-center">
									<div className="col-auto">
										<img height={36} src={RedPlayerProfile} alt="rpp" />
									</div>
									<div className={`col ${turn === PlayerTypesEnum.RED ? "text-white" : "text-muted"}`}>
										<div className="row align-items-center justify-content-between gx-4">
											<div className="col-auto">
												<h4 className="m-0">
													Red Player
												</h4>
											</div>
											<div className="col">
												<div hidden={(turn !== PlayerTypesEnum.RED) || (aiEnabled)} className="badge rounded-pill bg-dark text-light">Your turn</div>
											</div>
											<div className="col-auto">
												<div className="form-check form-switch m-0">
													<label className="form-check-label text-white fw-bold" htmlFor="aiModeSwitch">AI Mode {aiEnabled}</label>
													<input checked={aiEnabled}
														onChange={(e) => {
															// Toggle ai mode for next moves of RED player
															dispatch(toggleAI());
														}}
														className="form-check-input"
														type="checkbox"
														id="aiModeSwitch" />
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div className="board" ref={stageContainerRef}>
								<Stage className="stage" width={getBoardSize()} height={getBoardSize() - (2 * (getCellSize()))}>
									<BoardLayer boardSize={getBoardSize()} gridSize={getCellSize()} />
									<Layer ref={stagePiecesLayerRef}>
										{drawBoardPieces()}
										{drawHighlight()}
									</Layer>

									<Layer>
										{drawLaser()}
									</Layer>
								</Stage>
							</div>
							<div className="text-white py-3">
								<div className="row align-items-center">
									<div className="col-auto">
										<img height={36} src={BluePlayerProfile} alt="bpp" />
									</div>
									<div className={`col ${turn === PlayerTypesEnum.BLUE ? "text-white" : "text-muted"}`}>
										<div className="row align-items-center gx-4">
											<div className="col-auto">
												<h4 className="m-0">
													Blue Player
												</h4>
											</div>
											<div className="col">
												<div hidden={turn !== PlayerTypesEnum.BLUE} className="badge rounded-pill bg-dark text-light">Your turn</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="col text-white">
						{winner && <h1>🎉 {winner.toUpperCase()} player wins!</h1>}
					</div>
				</div>
			</div>


			<div className="container mt-5 p-3 text-muted">
				<hr />
				<small><a href="https://github.com/kishannareshpal/laserchess">Laser Chess - 1.0.0-alpha.2</a> - <a className="text-muted" href="https://kishanjadav.com">Kishan Jadav</a></small>
			</div>
		</div >
	);
}

export default App;
