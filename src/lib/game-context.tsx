
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { generateAiMove, isPlayerOut, isGameOver } from './game-utils';

// Game state types
export type GameState = 'toss' | 'batting' | 'bowling' | 'gameOver';

// Type for game context
type GameContextType = {
  gameState: GameState;
  playerScore: number;
  aiScore: number;
  innings: number;
  target: number | null;
  playerChoice: number | null;
  aiChoice: number | null;
  userBatting: boolean;
  isOut: boolean;
  tossResult: string | null;
  ballsPlayed: number;
  startGame: (battingFirst: boolean) => void;
  resetGame: () => void;
  makeChoice: (userMove: number, aiMoveOverride?: number) => void;
  chooseToss: (choice: 'heads' | 'tails') => void;
  chooseBatOrBowl: (choice: 'bat' | 'bowl') => void;
};

// Initial state for game context
const initialState = {
  gameState: 'toss' as GameState,
  playerScore: 0,
  aiScore: 0,
  innings: 1,
  target: null,
  playerChoice: null,
  aiChoice: null,
  userBatting: false,
  isOut: false,
  tossResult: null,
  ballsPlayed: 0,
};

// Create context
const GameContext = createContext<GameContextType | undefined>(undefined);

// Provider component
export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>('toss');
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [innings, setInnings] = useState(1);
  const [target, setTarget] = useState<number | null>(null);
  const [userBatting, setUserBatting] = useState(false);
  const [playerChoice, setPlayerChoice] = useState<number | null>(null);
  const [aiChoice, setAiChoice] = useState<number | null>(null);
  const [isOut, setIsOut] = useState(false);
  const [tossResult, setTossResult] = useState<string | null>(null);
  const [ballsPlayed, setBallsPlayed] = useState(0);

  // Reset game state
  const resetGame = () => {
    setGameState('toss');
    setPlayerScore(0);
    setAiScore(0);
    setInnings(1);
    setTarget(null);
    setUserBatting(false);
    setPlayerChoice(null);
    setAiChoice(null);
    setIsOut(false);
    setTossResult(null);
    setBallsPlayed(0);
  };

  // Handle user move with optional AI move override
  const makeChoice = (userMove: number, aiMoveOverride?: number) => {
    if (userMove < 1 || userMove > 6) {
      throw new Error('Invalid move: Must be between 1 and 6');
    }

    const aiMove = aiMoveOverride !== undefined ? aiMoveOverride : generateAiMove();
    setPlayerChoice(userMove);
    setAiChoice(aiMove);
    
    // Increment balls played
    setBallsPlayed(prev => prev + 1);

    // Check if out
    if (isPlayerOut(userMove, aiMove)) {
      handlePlayerOut();
      return;
    }

    // Not out, update scores
    updateScores(userMove, aiMove);
  };

  // Handle player out scenario
  const handlePlayerOut = () => {
    setIsOut(true);
    
    if (userBatting) {
      handleBattingPlayerOut();
    } else {
      handleBowlingPlayerOut();
    }
  };

  // Handle batting player out
  const handleBattingPlayerOut = () => {
    if (target === null) {
      // First innings, set target for AI
      setTarget(playerScore + 1);
      setUserBatting(false);
      setIsOut(false);
      setGameState('bowling');
      setInnings(2);
      setBallsPlayed(0); // Reset balls played for second innings
      
      // Increased delay to let the OUT! message be seen longer
      setTimeout(() => {
        setPlayerChoice(null);
        setAiChoice(null);
      }, 3000); // Increased from 1500ms to 3000ms
    } else {
      // Second innings, game over
      setGameState('gameOver');
    }
  };

  // Handle bowling player out
  const handleBowlingPlayerOut = () => {
    if (target === null) {
      // First innings, set target for user
      setTarget(aiScore + 1);
      setUserBatting(true);
      setIsOut(false);
      setGameState('batting');
      setInnings(2);
      setBallsPlayed(0); // Reset balls played for second innings
      
      // Increased delay to let the OUT! message be seen longer
      setTimeout(() => {
        setPlayerChoice(null);
        setAiChoice(null);
      }, 3000); // Increased from 1500ms to 3000ms
    } else {
      // Second innings, game over
      setGameState('gameOver');
    }
  };

  // Update scores based on player and AI choices
  const updateScores = (userMove: number, aiMove: number) => {
    if (userBatting) {
      const newScore = playerScore + userMove;
      setPlayerScore(newScore);
      
      // Check if target achieved in second innings
      if (isGameOver(innings, newScore, target)) {
        setGameState('gameOver');
      } else {
        // Increased delay before resetting choices to make them visible longer
        setTimeout(() => {
          setPlayerChoice(null);
          setAiChoice(null);
          setIsOut(false);
        }, 2500); // Increased from 1000ms to 2500ms
      }
    } else {
      const newScore = aiScore + aiMove;
      setAiScore(newScore);
      
      // Check if target achieved in second innings
      if (isGameOver(innings, newScore, target)) {
        setGameState('gameOver');
      } else {
        // Increased delay before resetting choices to make them visible longer
        setTimeout(() => {
          setPlayerChoice(null);
          setAiChoice(null);
          setIsOut(false);
        }, 2500); // Increased from 1000ms to 2500ms
      }
    }
  };

  // Start game after toss
  const startGame = (battingFirst: boolean) => {
    setUserBatting(battingFirst);
    setGameState(battingFirst ? 'batting' : 'bowling');
    setBallsPlayed(0); // Reset balls played at the start of the game
    
    // Clear any previous choices when starting a new game
    setPlayerChoice(null);
    setAiChoice(null);
    setIsOut(false);
  };

  // Handle toss choice
  const chooseToss = (choice: 'heads' | 'tails') => {
    const tossOutcome = Math.random() > 0.5 ? 'heads' : 'tails';
    const userWonToss = choice === tossOutcome;
    
    setTossResult(userWonToss ? 'You won the toss!' : 'AI won the toss!');
    
    if (!userWonToss) {
      // AI chooses to bat or bowl
      const aiChoice = Math.random() > 0.5;
      setUserBatting(!aiChoice);
      // We don't set gameState here, this is handled by the UI
    }
    
    // If user won, they need to choose bat or bowl
    // This will be handled by chooseBatOrBowl
  };

  // Handle bat or bowl choice after winning toss
  const chooseBatOrBowl = (choice: 'bat' | 'bowl') => {
    setUserBatting(choice === 'bat');
    setGameState(choice === 'bat' ? 'batting' : 'bowling');
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        playerScore,
        aiScore,
        innings,
        target,
        playerChoice,
        aiChoice,
        userBatting,
        isOut,
        tossResult,
        ballsPlayed,
        startGame,
        resetGame,
        makeChoice,
        chooseToss,
        chooseBatOrBowl,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// Custom hook to use game context
export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
