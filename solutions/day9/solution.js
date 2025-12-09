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

  await timeSolution('Part 1 (Test)', () => solveForFirstStar(test, true))
  await timeSolution('Part 1', () => solveForFirstStar(input))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parseCoordinates (input) {
  return input.split('\n').map(line => {
    const [x, y] = line.split(',').map(Number)
    return { x, y }
  })
}

function renderOutput (coordinates, squares, padding = 1) {
  const output = []
  const xs = coordinates.map(c => c.x)
  const ys = coordinates.map(c => c.y)
  const minX = Math.min(...xs) - padding
  const maxX = Math.max(...xs) + padding
  const minY = Math.min(...ys) - padding
  const maxY = Math.max(...ys) + padding

  for (let y = minY; y <= maxY; y++) {
    let line = ''
    for (let x = minX; x <= maxX; x++) {
      line += '.'
    }
    output.push(line)
  }

  // Mark square areas using O symbols
  squares.forEach((square, index) => {
    for (let y = square.top; y <= square.bottom; y++) {
      for (let x = square.left; x <= square.right; x++) {
        const line = output[y - minY]
        output[y - minY] = line.substring(0, x - minX) + 'O' + line.substring(x - minX + 1)
      }
    }
  })

  // Mark the coordinates using # symbols
  coordinates.forEach((coord, index) => {
    const line = output[coord.y - minY]
    output[coord.y - minY] = line.substring(0, coord.x - minX) + '#' + line.substring(coord.x - minX + 1)
  })

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

    const outputGrid = renderOutput(coordinates, [largestRectangle])
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
