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
  await timeSolution('Part 1', () => solveForFirstStar(input, false))
  await timeSolution('Part 2 (Test)', () => solveForSecondStar(test, { produceOutput: true, outputFile: 'output-p2.txt' }))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parseCoordinates (input) {
  return input.split('\n').map(line => {
    const [x, y] = line.split(',').map(Number)
    return { x, y }
  })
}

function buildOrthogonalEdges (points) {
  const vertical = []
  const horizontal = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (a.x === b.x) {
      vertical.push({
        x: a.x,
        y1: Math.min(a.y, b.y),
        y2: Math.max(a.y, b.y)
      })
    } else if (a.y === b.y) {
      horizontal.push({
        y: a.y,
        x1: Math.min(a.x, b.x),
        x2: Math.max(a.x, b.x)
      })
    } else {
      throw new Error('Non-orthogonal edge encountered')
    }
  }
  return { vertical, horizontal }
}

function isPointOnSegment (px, py, ax, ay, bx, by) {
  if (ax === bx && px === ax) {
    const minY = Math.min(ay, by)
    const maxY = Math.max(ay, by)
    return py >= minY && py <= maxY
  }
  if (ay === by && py === ay) {
    const minX = Math.min(ax, bx)
    const maxX = Math.max(ax, bx)
    return px >= minX && px <= maxX
  }
  return false
}

function isPointInsideOrOnPolygon ({ x, y }, polygon, cache) {
  const key = `${x},${y}`
  if (cache && cache.has(key)) {
    return cache.get(key)
  }

  let inside = false
  const hitBoundary = polygon.some((point, currentIndex) => {
    const nextIndex = (currentIndex + 1) % polygon.length
    const ax = point.x
    const ay = point.y
    const bx = polygon[nextIndex].x
    const by = polygon[nextIndex].y

    if (isPointOnSegment(x, y, ax, ay, bx, by)) {
      if (cache) cache.set(key, true)
      return true
    }

    const intersects = ((ay > y) !== (by > y)) &&
      (x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
    if (intersects) {
      inside = !inside
    }
    return false
  })

  if (hitBoundary) {
    return true
  }

  if (cache) cache.set(key, inside)
  return inside
}

function rectangleIntersectsPolygonInterior (rect, verticalEdges, horizontalEdges) {
  const { left, right, top, bottom } = rect

  if (right - left > 1) {
    for (const edge of verticalEdges) {
      if (edge.x > left && edge.x < right) {
        const overlapMin = Math.max(top, edge.y1)
        const overlapMax = Math.min(bottom, edge.y2)
        if (overlapMin < overlapMax) {
          return true
        }
      }
    }
  }

  if (bottom - top > 1) {
    for (const edge of horizontalEdges) {
      if (edge.y > top && edge.y < bottom) {
        const overlapMin = Math.max(left, edge.x1)
        const overlapMax = Math.min(right, edge.x2)
        if (overlapMin < overlapMax) {
          return true
        }
      }
    }
  }

  return false
}

function renderOutput (coordinates, squares, viewport = { left: 0, top: 0, width: 200, height: 100, padding: 0 }, polygon = null) {
  const { left, top, width, height, padding = 0 } = viewport

  const allXs = []
  const allYs = []
  coordinates.forEach(({ x, y }) => {
    allXs.push(x)
    allYs.push(y)
  })
  squares.forEach(square => {
    allXs.push(square.left, square.right)
    allYs.push(square.top, square.bottom)
  })

  const dataMinX = allXs.length ? Math.min(...allXs) : left
  const dataMaxX = allXs.length ? Math.max(...allXs) : left
  const dataMinY = allYs.length ? Math.min(...allYs) : top
  const dataMaxY = allYs.length ? Math.max(...allYs) : top

  const allowedMinX = dataMinX - padding
  const allowedMaxX = dataMaxX + padding + 1
  const allowedMinY = dataMinY - padding
  const allowedMaxY = dataMaxY + padding + 1

  const xStart = Math.max(left - padding, allowedMinX)
  const xEnd = Math.min(left + width + padding, allowedMaxX)
  const yStart = Math.max(top - padding, allowedMinY)
  const yEnd = Math.min(top + height + padding, allowedMaxY)

  if (xStart >= xEnd || yStart >= yEnd) {
    return ''
  }

  // Precompute sets for fast lookup, but only for visible viewport
  const coordSet = new Set(coordinates.map(c => `${c.x},${c.y}`))
  const squareSet = new Set()
  squares.forEach(square => {
    for (let y = Math.max(square.top, yStart); y <= Math.min(square.bottom, yEnd - 1); y++) {
      for (let x = Math.max(square.left, xStart); x <= Math.min(square.right, xEnd - 1); x++) {
        squareSet.add(`${x},${y}`)
      }
    }
  })

  const polygonCache = polygon ? new Map() : null

  function renderAt (x, y) {
    if (coordSet.has(`${x},${y}`)) return '🟥'
    if (squareSet.has(`${x},${y}`)) return '🟩'
    if (polygon && isPointInsideOrOnPolygon({ x, y }, polygon, polygonCache)) return '🟦'
    return '⬛'
  }

  const output = []
  for (let y = yStart; y < yEnd; y++) {
    let line = ''
    for (let x = xStart; x < xEnd; x++) {
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
      width: 200,
      height: 100,
      padding: 2
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

function findLargestRectangleWithinPolygon (coordinates, polygon, verticalEdges, horizontalEdges, insideCache) {
  let largestRectangle = { area: 0 }

  coordinates.forEach((a, i) => {
    coordinates.slice(i + 1).forEach(b => {
      const rect = {
        left: Math.min(a.x, b.x),
        right: Math.max(a.x, b.x),
        top: Math.min(a.y, b.y),
        bottom: Math.max(a.y, b.y)
      }
      rect.area = (rect.right - rect.left + 1) * (rect.bottom - rect.top + 1)

      if (rect.area <= largestRectangle.area) {
        return
      }

      const corners = [
        { x: rect.left, y: rect.top },
        { x: rect.left, y: rect.bottom },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom }
      ]

      const allCornersInside = corners.every(corner =>
        isPointInsideOrOnPolygon(corner, polygon, insideCache)
      )
      if (!allCornersInside) {
        return
      }

      if (rectangleIntersectsPolygonInterior(rect, verticalEdges, horizontalEdges)) {
        return
      }

      largestRectangle = rect
    })
  })

  return largestRectangle
}

async function solveForSecondStar (input, options = {}) {
  const { produceOutput = false, outputFile = 'output-p2.txt' } = options
  const coordinates = parseCoordinates(input)
  const polygon = coordinates
  const { vertical, horizontal } = buildOrthogonalEdges(coordinates)
  const insideCache = new Map()

  const largestRectangle = findLargestRectangleWithinPolygon(coordinates, polygon, vertical, horizontal, insideCache)

  if (produceOutput) {
    const viewport = {
      left: largestRectangle.left,
      top: largestRectangle.top,
      width: 200,
      height: 100,
      padding: 2
    }
    const outputGrid = renderOutput(coordinates, [largestRectangle], viewport, polygon)
    console.log(outputGrid)
    await write(fromHere(outputFile), outputGrid)
  }

  report('Largest rectangle (red/green constraint):', largestRectangle)
  const solution = largestRectangle.area
  report('Solution 2:', solution)
  return solution
}

run()
