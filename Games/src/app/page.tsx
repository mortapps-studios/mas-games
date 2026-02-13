'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Game constants
const GRID_SIZE = 20
const INITIAL_SPEED = 150
const SPEED_INCREMENT = 5
const MIN_SPEED = 50

// Color themes
const THEMES = {
  neon: {
    name: 'Neon Cyberpunk',
    background: '#0a0a0f',
    grid: '#1a1a2e',
    snakeHead: '#00ff88',
    snakeBody: '#00cc6a',
    snakeGlow: '#00ff8855',
    food: '#ff0066',
    foodGlow: '#ff006655',
    text: '#ffffff',
    accent: '#00ff88',
    secondary: '#ff0066'
  },
  ocean: {
    name: 'Ocean Depths',
    background: '#0a1628',
    grid: '#0f2847',
    snakeHead: '#00d4ff',
    snakeBody: '#0099cc',
    snakeGlow: '#00d4ff55',
    food: '#ff6b35',
    foodGlow: '#ff6b3555',
    text: '#ffffff',
    accent: '#00d4ff',
    secondary: '#ff6b35'
  },
  sunset: {
    name: 'Sunset Blaze',
    background: '#1a0a1e',
    grid: '#2d1b30',
    snakeHead: '#ff9500',
    snakeBody: '#ff6b00',
    snakeGlow: '#ff950055',
    food: '#ff2d55',
    foodGlow: '#ff2d5555',
    text: '#ffffff',
    accent: '#ff9500',
    secondary: '#ff2d55'
  },
  arctic: {
    name: 'Arctic Frost',
    background: '#0f1419',
    grid: '#1c2530',
    snakeHead: '#64ffda',
    snakeBody: '#4fd1c5',
    snakeGlow: '#64ffda55',
    food: '#f093fb',
    foodGlow: '#f093fb55',
    text: '#ffffff',
    accent: '#64ffda',
    secondary: '#f093fb'
  }
}

type ThemeKey = keyof typeof THEMES
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type GameState = 'menu' | 'playing' | 'paused' | 'gameover'

interface Position {
  x: number
  y: number
}

export default function SnakeGame() {
  // Game state with lazy initialization from localStorage
  const [gameState, setGameState] = useState<GameState>('menu')
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<Position>({ x: 15, y: 10 })
  const [direction, setDirection] = useState<Direction>('RIGHT')
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = localStorage.getItem('snake_highScore')
    return saved ? parseInt(saved) : 0
  })
  const [speed, setSpeed] = useState(() => {
    if (typeof window === 'undefined') return INITIAL_SPEED
    const saved = localStorage.getItem('snake_speed')
    return saved ? parseInt(saved) : INITIAL_SPEED
  })
  const [theme, setTheme] = useState<ThemeKey>(() => {
    if (typeof window === 'undefined') return 'neon'
    const saved = localStorage.getItem('snake_theme') as ThemeKey
    return saved && THEMES[saved] ? saved : 'neon'
  })
  const [isLandscape, setIsLandscape] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  
  // AI state
  const [aiTip, setAiTip] = useState<string>('')
  const [aiFeedback, setAiFeedback] = useState<string>('')
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const scoreRef = useRef(0)

  // Keep score in sync with ref
  useEffect(() => {
    scoreRef.current = score
  }, [score])

  // Current theme colors
  const colors = THEMES[theme]

  // Save preferences
  useEffect(() => {
    localStorage.setItem('snake_theme', theme)
    localStorage.setItem('snake_speed', speed.toString())
  }, [theme, speed])

  // Check landscape orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isLandscapeMode = window.innerWidth > window.innerHeight
      setIsLandscape(isLandscapeMode)
    }
    
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    
    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Generate random food position
  const generateFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      }
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y))
    return newFood
  }, [])

  // AI API calls
  const fetchAiTip = async () => {
    setIsLoadingAi(true)
    try {
      const response = await fetch('/api/ai-snake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tip' })
      })
      const data = await response.json()
      setAiTip(data.content || data.fallback || 'Keep practicing and you\'ll improve!')
    } catch {
      setAiTip('Focus on the center and plan your moves ahead!')
    }
    setIsLoadingAi(false)
  }

  // Handle game over - called from game loop
  const triggerGameOver = useCallback((snakeLength: number, finalScore: number) => {
    setGameState('gameover')
    setHighScore(prev => {
      if (finalScore > prev) {
        localStorage.setItem('snake_highScore', finalScore.toString())
        return finalScore
      }
      return prev
    })
    // Fetch AI feedback
    setIsLoadingAi(true)
    fetch('/api/ai-snake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        type: 'feedback', 
        data: { score: finalScore, highScore, length: snakeLength }
      })
    })
      .then(res => res.json())
      .then(data => setAiFeedback(data.content || data.fallback || 'Great effort!'))
      .catch(() => setAiFeedback('Nice try! Keep playing to beat your high score!'))
      .finally(() => setIsLoadingAi(false))
  }, [highScore])

  // Start game
  const startGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }]
    setSnake(initialSnake)
    setFood(generateFood(initialSnake))
    setDirection('RIGHT')
    setNextDirection('RIGHT')
    setScore(0)
    const savedSpeed = localStorage.getItem('snake_speed')
    setSpeed(savedSpeed ? parseInt(savedSpeed) : INITIAL_SPEED)
    setAiTip('')
    setAiFeedback('')
    setGameState('playing')
  }, [generateFood])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
      return
    }

    gameLoopRef.current = setInterval(() => {
      setSnake(currentSnake => {
        const currentDirection = nextDirection
        setDirection(currentDirection)
        
        const head = { ...currentSnake[0] }
        
        switch (currentDirection) {
          case 'UP': head.y -= 1; break
          case 'DOWN': head.y += 1; break
          case 'LEFT': head.x -= 1; break
          case 'RIGHT': head.x += 1; break
        }

        // Check wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          triggerGameOver(currentSnake.length, scoreRef.current)
          return currentSnake
        }

        // Check self collision
        if (currentSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          triggerGameOver(currentSnake.length, scoreRef.current)
          return currentSnake
        }

        const newSnake = [head, ...currentSnake]
        
        // Check food collision
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 10)
          setFood(generateFood(newSnake))
          setSpeed(currentSpeed => Math.max(MIN_SPEED, currentSpeed - SPEED_INCREMENT))
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, speed)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, speed, food, nextDirection, generateFood, triggerGameOver])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            if (direction !== 'DOWN') setNextDirection('UP')
            e.preventDefault()
            break
          case 'ArrowDown':
          case 's':
          case 'S':
            if (direction !== 'UP') setNextDirection('DOWN')
            e.preventDefault()
            break
          case 'ArrowLeft':
          case 'a':
          case 'A':
            if (direction !== 'RIGHT') setNextDirection('LEFT')
            e.preventDefault()
            break
          case 'ArrowRight':
          case 'd':
          case 'D':
            if (direction !== 'LEFT') setNextDirection('RIGHT')
            e.preventDefault()
            break
          case 'Escape':
          case 'p':
          case 'P':
            setGameState('paused')
            break
        }
      } else if (gameState === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          setGameState('playing')
        }
      } else if (gameState === 'menu' || gameState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          startGame()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, direction, startGame])

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y
    const minSwipe = 30

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > minSwipe && direction !== 'LEFT') {
        setNextDirection('RIGHT')
      } else if (deltaX < -minSwipe && direction !== 'RIGHT') {
        setNextDirection('LEFT')
      }
    } else {
      if (deltaY > minSwipe && direction !== 'UP') {
        setNextDirection('DOWN')
      } else if (deltaY < -minSwipe && direction !== 'DOWN') {
        setNextDirection('UP')
      }
    }

    touchStartRef.current = null
  }

  // Direction button handler
  const handleDirectionButton = (newDirection: Direction) => {
    if (gameState !== 'playing') return
    
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT'
    }
    
    if (direction !== opposites[newDirection]) {
      setNextDirection(newDirection)
    }
  }

  // Draw game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cellSize = canvas.width / GRID_SIZE

    // Clear canvas
    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * cellSize, 0)
      ctx.lineTo(i * cellSize, canvas.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * cellSize)
      ctx.lineTo(canvas.width, i * cellSize)
      ctx.stroke()
    }

    // Draw food with glow
    ctx.shadowColor = colors.foodGlow
    ctx.shadowBlur = 15
    ctx.fillStyle = colors.food
    ctx.beginPath()
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize / 2 - 2,
      0,
      Math.PI * 2
    )
    ctx.fill()
    ctx.shadowBlur = 0

    // Draw snake
    snake.forEach((segment, index) => {
      const isHead = index === 0
      
      // Glow effect for head
      if (isHead) {
        ctx.shadowColor = colors.snakeGlow
        ctx.shadowBlur = 20
      }
      
      ctx.fillStyle = isHead ? colors.snakeHead : colors.snakeBody
      
      // Rounded rectangle for snake segments
      const padding = 1
      const radius = 4
      const x = segment.x * cellSize + padding
      const y = segment.y * cellSize + padding
      const width = cellSize - padding * 2
      const height = cellSize - padding * 2

      ctx.beginPath()
      ctx.roundRect(x, y, width, height, radius)
      ctx.fill()
      
      ctx.shadowBlur = 0

      // Draw eyes on head
      if (isHead) {
        ctx.fillStyle = colors.background
        const eyeSize = 3
        const eyeOffset = cellSize / 4
        
        let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number
        
        switch (direction) {
          case 'UP':
            eye1X = segment.x * cellSize + cellSize / 2 - eyeOffset
            eye1Y = segment.y * cellSize + cellSize / 3
            eye2X = segment.x * cellSize + cellSize / 2 + eyeOffset
            eye2Y = segment.y * cellSize + cellSize / 3
            break
          case 'DOWN':
            eye1X = segment.x * cellSize + cellSize / 2 - eyeOffset
            eye1Y = segment.y * cellSize + cellSize * 2 / 3
            eye2X = segment.x * cellSize + cellSize / 2 + eyeOffset
            eye2Y = segment.y * cellSize + cellSize * 2 / 3
            break
          case 'LEFT':
            eye1X = segment.x * cellSize + cellSize / 3
            eye1Y = segment.y * cellSize + cellSize / 2 - eyeOffset
            eye2X = segment.x * cellSize + cellSize / 3
            eye2Y = segment.y * cellSize + cellSize / 2 + eyeOffset
            break
          case 'RIGHT':
          default:
            eye1X = segment.x * cellSize + cellSize * 2 / 3
            eye1Y = segment.y * cellSize + cellSize / 2 - eyeOffset
            eye2X = segment.x * cellSize + cellSize * 2 / 3
            eye2Y = segment.y * cellSize + cellSize / 2 + eyeOffset
        }
        
        ctx.beginPath()
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }, [snake, food, direction, colors])

  // Handle canvas size
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const container = canvas.parentElement
      if (!container) return
      
      const maxSize = Math.min(container.clientWidth - 32, 500)
      canvas.width = maxSize
      canvas.height = maxSize
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 select-none"
      style={{ backgroundColor: colors.background, color: colors.text }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Portrait mode warning */}
      {!isLandscape && gameState === 'playing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-xl font-bold mb-2">Rotate Your Device</p>
            <p className="text-sm opacity-70">This game works best in landscape mode</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: colors.accent, color: colors.background }}
          >
            🐍
          </div>
          <span className="font-bold text-lg">MortApps Studios</span>
        </div>
        
        {gameState === 'playing' && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="opacity-70 text-xs">SCORE</div>
              <div className="font-bold text-xl" style={{ color: colors.accent }}>{score}</div>
            </div>
            <div className="text-center">
              <div className="opacity-70 text-xs">HIGH</div>
              <div className="font-bold text-xl">{highScore}</div>
            </div>
            <button
              onClick={() => setGameState('paused')}
              className="p-2 rounded-lg hover:opacity-70 transition-opacity"
              style={{ backgroundColor: colors.grid }}
            >
              ⏸️
            </button>
          </div>
        )}
      </div>

      {/* Main game area */}
      <div className="flex flex-col lg:flex-row items-center gap-4 w-full max-w-2xl">
        {/* Canvas container */}
        <div 
          className="relative rounded-2xl p-4 flex-1"
          style={{ backgroundColor: colors.grid }}
        >
          <canvas
            ref={canvasRef}
            className="rounded-lg mx-auto block"
            style={{ touchAction: 'none' }}
          />

          {/* Menu overlay */}
          {gameState === 'menu' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ backgroundColor: `${colors.background}ee` }}>
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🐍</div>
                <h1 className="text-4xl font-bold mb-2" style={{ color: colors.accent }}>Snake Classic</h1>
                <p className="text-sm opacity-70 mb-6">Eat food. Grow longer. Don&apos;t hit walls or yourself!</p>
                
                {aiTip && (
                  <div 
                    className="text-sm p-3 rounded-lg mb-4 italic"
                    style={{ backgroundColor: colors.grid }}
                  >
                    💡 {aiTip}
                  </div>
                )}
                
                <button
                  onClick={startGame}
                  className="px-8 py-3 rounded-xl font-bold text-lg transition-all hover:scale-105 mb-3"
                  style={{ backgroundColor: colors.accent, color: colors.background }}
                >
                  ▶ Play Game
                </button>
                
                <div className="flex gap-2 justify-center mt-4">
                  <button
                    onClick={fetchAiTip}
                    disabled={isLoadingAi}
                    className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-70 disabled:opacity-50"
                    style={{ backgroundColor: colors.grid }}
                  >
                    {isLoadingAi ? '⏳' : '💡'} Get AI Tip
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
                    style={{ backgroundColor: colors.grid }}
                  >
                    ⚙️ Settings
                  </button>
                </div>

                {showSettings && (
                  <div 
                    className="mt-4 p-4 rounded-lg text-left"
                    style={{ backgroundColor: colors.background }}
                  >
                    <div className="mb-4">
                      <label className="text-sm opacity-70 block mb-2">Theme</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(THEMES).map(([key, t]) => (
                          <button
                            key={key}
                            onClick={() => setTheme(key as ThemeKey)}
                            className={`px-3 py-1 rounded-lg text-sm transition-all ${theme === key ? 'ring-2 ring-offset-1' : ''}`}
                            style={{ 
                              backgroundColor: t.grid,
                              color: t.text,
                            }}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm opacity-70 block mb-2">Speed: {speed}ms</label>
                      <input
                        type="range"
                        min={MIN_SPEED}
                        max={250}
                        step={10}
                        value={speed}
                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                        className="w-full"
                        style={{ accentColor: colors.accent }}
                      />
                      <div className="flex justify-between text-xs opacity-50">
                        <span>Fast</span>
                        <span>Slow</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 text-xs opacity-50">
                  <p>PC: Arrow keys or WASD | Mobile: Swipe or buttons</p>
                </div>
              </div>
            </div>
          )}

          {/* Paused overlay */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ backgroundColor: `${colors.background}ee` }}>
              <div className="text-center p-8">
                <div className="text-5xl mb-4">⏸️</div>
                <h2 className="text-3xl font-bold mb-4">Paused</h2>
                <button
                  onClick={() => setGameState('playing')}
                  className="px-6 py-2 rounded-xl font-bold transition-all hover:scale-105 mb-3"
                  style={{ backgroundColor: colors.accent, color: colors.background }}
                >
                  ▶ Resume
                </button>
                <br />
                <button
                  onClick={() => setGameState('menu')}
                  className="px-6 py-2 rounded-xl font-bold mt-2 transition-opacity hover:opacity-70"
                  style={{ backgroundColor: colors.grid }}
                >
                  🏠 Menu
                </button>
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ backgroundColor: `${colors.background}ee` }}>
              <div className="text-center p-8">
                <div className="text-5xl mb-4">💀</div>
                <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
                <div className="mb-4">
                  <div className="text-2xl font-bold" style={{ color: colors.accent }}>Score: {score}</div>
                  {score >= highScore && score > 0 && (
                    <div className="text-sm mt-1" style={{ color: colors.secondary }}>🎉 New High Score!</div>
                  )}
                </div>
                
                {aiFeedback && (
                  <div 
                    className="text-sm p-3 rounded-lg mb-4 italic"
                    style={{ backgroundColor: colors.grid }}
                  >
                    🤖 {aiFeedback}
                  </div>
                )}
                
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={startGame}
                    className="px-6 py-2 rounded-xl font-bold transition-all hover:scale-105"
                    style={{ backgroundColor: colors.accent, color: colors.background }}
                  >
                    🔄 Play Again
                  </button>
                  <button
                    onClick={() => setGameState('menu')}
                    className="px-6 py-2 rounded-xl font-bold transition-opacity hover:opacity-70"
                    style={{ backgroundColor: colors.grid }}
                  >
                    🏠 Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        {gameState === 'playing' && (
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <button
              onClick={() => handleDirectionButton('UP')}
              className="w-16 h-16 rounded-xl text-2xl active:scale-95 transition-transform flex items-center justify-center"
              style={{ backgroundColor: colors.grid }}
            >
              ⬆️
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleDirectionButton('LEFT')}
                className="w-16 h-16 rounded-xl text-2xl active:scale-95 transition-transform flex items-center justify-center"
                style={{ backgroundColor: colors.grid }}
              >
                ⬅️
              </button>
              <button
                onClick={() => handleDirectionButton('DOWN')}
                className="w-16 h-16 rounded-xl text-2xl active:scale-95 transition-transform flex items-center justify-center"
                style={{ backgroundColor: colors.grid }}
              >
                ⬇️
              </button>
              <button
                onClick={() => handleDirectionButton('RIGHT')}
                className="w-16 h-16 rounded-xl text-2xl active:scale-95 transition-transform flex items-center justify-center"
                style={{ backgroundColor: colors.grid }}
              >
                ➡️
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs opacity-50 text-center">
        <p>© 2026 MortApps Studios</p>
      </div>
    </div>
  )
}
