const path = require('path')
const { read, write, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function timeSolution (label, fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
  report(`${label} completed in ${elapsedMs.toFixed(3)}ms`)
  return result
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (Test)', () => solveForFirstStar(test, false))
  await timeSolution('Part 1', () => solveForFirstStar(input, true))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parseCoordinates (input) {
  return input.split('\n').map(line => {
    const [x, y] = line.split(',').map(Number)
    return { x, y }
  })
}
function renderOutput (coordinates, squares, viewport = { left: 0, top: 0, width: 100, height: 100, padding: 0 }) {
  const { left, top, width, height, padding = 0 } = viewport

  // Precompute sets for fast lookup, but only for visible viewport
  const coordSet = new Set(coordinates.map(c => `${c.x},${c.y}`))
  const squareSet = new Set()
  squares.forEach(square => {
    for (let y = Math.max(square.top, top - padding); y <= Math.min(square.bottom, top + height + padding - 1); y++) {
      if (y < top - padding || y >= top + height + padding) continue
      for (let x = Math.max(square.left, left - padding); x <= Math.min(square.right, left + width + padding - 1); x++) {
        if (x < left - padding || x >= left + width + padding) continue
        squareSet.add(`${x},${y}`)
      }
    }
  })

  function renderAt (x, y) {
    if (coordSet.has(`${x},${y}`)) return '#'
    if (squareSet.has(`${x},${y}`)) return 'O'
    return '.'
  }

  const output = []
  for (let y = top - padding; y < top + height + padding; y++) {
    let line = ''
    for (let x = left - padding; x < left + width + padding; x++) {
      line += renderAt(x, y)
    }
    output.push(line)
  }

  return output.join('\n')
}

async function solveForFirstStar (input, produceOutput = false) {
  const coordinates = parseCoordinates(input)
  const possibleRectangles = []

  for (let i = 0; i < coordinates.length; i++) {
    for (let j = 0; j < coordinates.length; j++) {
      if (i === j) continue
      const rect = {
        left: Math.min(coordinates[i].x, coordinates[j].x),
        right: Math.max(coordinates[i].x, coordinates[j].x),
        top: Math.min(coordinates[i].y, coordinates[j].y),
        bottom: Math.max(coordinates[i].y, coordinates[j].y)
      }
      rect.area = (rect.right - rect.left + 1) * (rect.bottom - rect.top + 1)
      possibleRectangles.push(rect)
    }
  }

  // Find the rectangle with the largest area
  const largestRectangle = possibleRectangles.reduce((maxRect, rect) => {
    return rect.area > maxRect.area ? rect : maxRect
  }, { area: 0 })

  if (produceOutput === true) {
    console.log('Possible rectangles:', possibleRectangles)

    const viewport = {
      left: largestRectangle.left,
      top: largestRectangle.top,
      width: 90,
      height: 90,
      padding: 5
    }

    const outputGrid = renderOutput(coordinates, [largestRectangle], viewport)
    console.log(outputGrid)
    await write(fromHere('output.txt'), outputGrid)
  }

  report('Found', possibleRectangles.length, 'possible rectangles based on', coordinates.length, 'coordinates')

  report('Largest rectangle:', largestRectangle)

  const solution = largestRectangle.area
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
