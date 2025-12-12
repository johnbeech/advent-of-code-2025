const path = require('path')
const os = require('os')
const { mkdir } = require('fs/promises')
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')
const { read, write, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)
const BITMASK_WIDTH = 3
const BITMASK_HEIGHT = 3
const SHAPE_COLORS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬜']
const EMPTY_TILE = '⬛'
const SOLVER_TIMEOUT_MS = 10_000

const range = size => Array.from({ length: size }, (_, index) => index)
const placementCache = new Map()

async function ensureDir (dirPath) {
  await mkdir(dirPath, { recursive: true })
}

async function timeSolution (label, fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
  report(`${label} completed in ${elapsedMs.toFixed(3)}ms`)
  return result
}

function runRegionWorker (region, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: {
        mode: 'solve-region',
        region,
        timeoutMs
      }
    })
    worker.on('message', message => resolve(message))
    worker.on('error', reject)
    worker.on('exit', code => {
      if (code !== 0) {
        reject(new Error(`Region worker exited with code ${code}`))
      }
    })
  })
}

function solveRegionsParallel (regions, timeoutMs, onRegionComplete = () => {}) {
  const maxWorkers = Math.max(1, Math.min(os.cpus().length, regions.length))
  const results = Array(regions.length)
  let nextIndex = 0
  let active = 0

  return new Promise((resolve, reject) => {
    const launchNext = () => {
      if (nextIndex >= regions.length) {
        if (active === 0) {
          resolve(results)
        }
        return
      }
      const current = nextIndex++
      active++
      runRegionWorker(regions[current], timeoutMs)
        .then(async result => {
          results[current] = result
          await onRegionComplete(current, result)
        })
        .catch(error => {
          reject(error)
        })
        .finally(() => {
          active--
          launchNext()
        })
    }

    Array.from({ length: maxWorkers }).forEach(() => launchNext())
  })
}

function encodeMatrixToBitmask (matrix) {
  const height = matrix.length
  const width = matrix[0].length
  if (width !== BITMASK_WIDTH || height !== BITMASK_HEIGHT) {
    throw new Error(`All shapes must be ${BITMASK_WIDTH}x${BITMASK_HEIGHT}, got ${width}x${height}`)
  }
  let bitmask = 0
  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 1) {
        bitmask |= 1 << (y * width + x)
      }
    })
  })
  return bitmask
}

function decodeBitmaskToMatrix (bitmask) {
  const matrix = Array.from({ length: BITMASK_HEIGHT }, () => Array(BITMASK_WIDTH).fill(0))
  matrix.forEach((row, y) => {
    row.forEach((_, x) => {
      row[x] = (bitmask >> (y * BITMASK_WIDTH + x)) & 1
    })
  })
  return matrix
}

function bitmaskToLines (bitmask, filledTile = '#') {
  return decodeBitmaskToMatrix(bitmask).map(row =>
    row.map(cell => (cell === 1 ? filledTile : EMPTY_TILE)).join('')
  )
}

const ROTATE_90 = [6, 3, 0, 7, 4, 1, 8, 5, 2]
const FLIP_HORIZONTAL = [2, 1, 0, 5, 4, 3, 8, 7, 6]

function remapBitmask (bitmask, mapping) {
  let result = 0
  mapping.forEach((sourceIdx, targetIdx) => {
    result |= ((bitmask >> sourceIdx) & 1) << targetIdx
  })
  return result
}

const rotateBitmask1Turn = bitmask => remapBitmask(bitmask, ROTATE_90)
const flipBitmaskHorizontally = bitmask => remapBitmask(bitmask, FLIP_HORIZONTAL)

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

function createVariant (bitmask) {
  const cells = []
  let minX = BITMASK_WIDTH
  let minY = BITMASK_HEIGHT
  let maxX = -1
  let maxY = -1

  range(BITMASK_HEIGHT).forEach(y => {
    range(BITMASK_WIDTH).forEach(x => {
      if ((bitmask >> (y * BITMASK_WIDTH + x)) & 1) {
        cells.push({ x, y })
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    })
  })

  if (cells.length === 0) {
    return {
      bitmask,
      width: 0,
      height: 0,
      cells: []
    }
  }

  const normalizedCells = cells.map(({ x, y }) => ({ x: x - minX, y: y - minY }))
  return {
    bitmask,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cells: normalizedCells
  }
}

function getShapeVariants (bitmask) {
  const variants = new Set()
  let rotated = bitmask
  Array.from({ length: 4 }).forEach(() => {
    variants.add(rotated)
    rotated = rotateBitmask1Turn(rotated)
  })

  let flipped = flipBitmaskHorizontally(bitmask)
  Array.from({ length: 4 }).forEach(() => {
    variants.add(flipped)
    flipped = rotateBitmask1Turn(flipped)
  })

  return Array.from(variants).map(createVariant)
}

function isCellFilled (boardRows, x, y) {
  return ((boardRows[y] >> BigInt(x)) & 1n) === 1n
}

function findEmptyComponents (boardRows, width, height) {
  const visited = Array.from({ length: height }, () => Array(width).fill(false))
  const components = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x] || isCellFilled(boardRows, x, y)) {
        continue
      }
      let size = 0
      const queue = [[x, y]]
      visited[y][x] = true
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()
        size++
        for (const [dx, dy] of DIRECTIONS) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue
          }
          if (visited[ny][nx] || isCellFilled(boardRows, nx, ny)) {
            continue
          }
          visited[ny][nx] = true
          queue.push([nx, ny])
        }
      }
      components.push(size)
    }
  }
  return components
}

function smallestRemainingShapeArea (shapeInstances, used) {
  let minArea = Infinity
  shapeInstances.forEach((instance, index) => {
    if (!used[index]) {
      minArea = Math.min(minArea, instance.shape.area)
    }
  })
  return Number.isFinite(minArea) ? minArea : 0
}

function remainingShapeArea (shapeInstances, used) {
  let total = 0
  shapeInstances.forEach((instance, index) => {
    if (!used[index]) {
      total += instance.shape.area
    }
  })
  return total
}

function precomputePlacementsForShape (shape, regionWidth, regionHeight) {
  const cacheKey = `${shape.shapeId}-${regionWidth}x${regionHeight}`
  if (placementCache.has(cacheKey)) {
    return placementCache.get(cacheKey)
  }

  const placements = []
  shape.variants.forEach((variant, variantIndex) => {
    const limitX = regionWidth - variant.width
    const limitY = regionHeight - variant.height
    if (limitX < 0 || limitY < 0) {
      return
    }
    range(limitY + 1).forEach(posY => {
      range(limitX + 1).forEach(posX => {
        const rowBitMap = new Map()
        const cells = []
        variant.cells.forEach(({ x, y }) => {
          const boardX = posX + x
          const boardY = posY + y
          const bit = 1n << BigInt(boardX)
          const existing = rowBitMap.get(boardY) || 0n
          rowBitMap.set(boardY, existing | bit)
          cells.push(boardY * regionWidth + boardX)
        })
        const rows = Array.from(rowBitMap.entries()).map(([rowIndex, bitMask]) => ({
          rowIndex,
          bitMask
        }))
        placements.push({
          shape,
          shapeId: shape.shapeId,
          variant,
          variantIndex,
          position: { x: posX, y: posY },
          rows,
          cells
        })
      })
    })
  })

  placementCache.set(cacheKey, placements)
  return placements
}

function parsePresentList (input) {
  const sections = input.split('\n\n').map(line => line.trim()).filter(line => line.length > 0)
  const shapes = sections.slice(0, -1).map((section, shapeId) => {
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const shapeMask = lines.slice(1)
    const maskMatrix = shapeMask.map(line => line.split('').map(char => char === '#' ? 1 : 0))
    const bitmask = encodeMatrixToBitmask(maskMatrix)
    const variants = getShapeVariants(bitmask)
    return {
      shapeId,
      width: BITMASK_WIDTH,
      height: BITMASK_HEIGHT,
      bitmask,
      variants,
      area: variants[0].cells.length
    }
  })

  shapes.toString = function () {
    return this.map(shape => {
      const variantLines = shape.variants.map((variant, variantIndex) => {
        const filledTile = SHAPE_COLORS[variantIndex % SHAPE_COLORS.length]
        return bitmaskToLines(variant.bitmask, filledTile)
      })
      const combined = Array.from({ length: BITMASK_HEIGHT }, (_, rowIndex) =>
        variantLines.map(lines => lines[rowIndex]).join(' | ')
      ).join('\n')
      return `Shape ${shape.shapeId}:\n${combined}`
    }).join('\n\n')
  }

  const regionLines = sections.pop().split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const regions = regionLines.map((line, regionId) => {
    const [dimensions, quantitiesStr] = line.split(':').map(part => part.trim())
    const [width, height] = dimensions.split('x').map(Number)
    const quantities = quantitiesStr.trim().split(' ').map(Number).map((quantity, index) => {
      return {
        shape: shapes[index],
        quantity
      }
    })
    return {
      regionId,
      width,
      height,
      quantities
    }
  })

  regions.toString = function () {
    return this.map(region => {
      const quantitiesStr = region.quantities.map(q => `S${q.shape.shapeId}: Q${q.quantity}`).join(', ')
      return `Region ${region.regionId} (${region.width}x${region.height}): ${quantitiesStr}`
    }).join('\n')
  }

  return {
    shapes,
    regions
  }
}

function evaluateRegionHeuristics (region) {
  const requiredArea = region.quantities.reduce((sum, quantity) => sum + quantity.quantity * quantity.shape.area, 0)
  const availableArea = region.width * region.height
  if (availableArea < requiredArea) {
    return {
      status: 'fails',
      reason: `Insufficient area (${availableArea} < ${requiredArea})`
    }
  }
  const availableSlots = Math.floor(region.width / BITMASK_WIDTH) * Math.floor(region.height / BITMASK_HEIGHT)
  const neededSlots = region.quantities.reduce((sum, quantity) => sum + quantity.quantity, 0)
  if (availableSlots >= neededSlots) {
    return {
      status: 'fits',
      reason: `Sufficient 3x3 slots (${availableSlots} >= ${neededSlots})`
    }
  }
  return {
    status: 'unknown'
  }
}

function solveRegion (region, timeoutMs = SOLVER_TIMEOUT_MS) {
  const boardRows = Array.from({ length: region.height }, () => 0n)
  const startTime = Date.now()
  let timedOut = false
  const shapeInstances = []
  let impossible = false
  let totalShapeArea = 0

  region.quantities.forEach(quantity => {
    if (quantity.quantity === 0) {
      return
    }
    totalShapeArea += quantity.quantity * quantity.shape.area
    const placements = precomputePlacementsForShape(quantity.shape, region.width, region.height)
    if (placements.length === 0) {
      impossible = true
      return
    }
    range(quantity.quantity).forEach(() => {
      shapeInstances.push({
        shape: quantity.shape,
        placements
      })
    })
  })

  if (impossible || totalShapeArea > region.width * region.height) {
    return {
      region,
      fits: false,
      timedOut: false,
      placements: []
    }
  }

  const used = Array(shapeInstances.length).fill(false)
  const placementsUsed = []
  const memo = new Map()

  const getBoardHash = () => boardRows.map(row => row.toString()).join(',')

  const findBestShape = () => {
    let bestIndex = -1
    let bestOptions = null
    for (let i = 0; i < shapeInstances.length; i++) {
      if (used[i]) {
        continue
      }
      const { placements } = shapeInstances[i]
      const validPlacements = []
      placements.forEach(placement => {
        const canPlace = placement.rows.every(({ rowIndex, bitMask }) => (boardRows[rowIndex] & bitMask) === 0n)
        if (canPlace) {
          validPlacements.push(placement)
        }
      })
      if (validPlacements.length === 0) {
        return { index: i, options: [] }
      }
      if (bestOptions === null || validPlacements.length < bestOptions.length) {
        bestOptions = validPlacements
        bestIndex = i
        if (validPlacements.length === 1) {
          break
        }
      }
    }
    return { index: bestIndex, options: bestOptions }
  }

  const tryPlace = placedCount => {
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true
      return false
    }

    if (placedCount === shapeInstances.length) {
      return true
    }

    const hash = `${placedCount}:${getBoardHash()}:${used.map(flag => (flag ? 1 : 0)).join('')}`
    if (memo.has(hash)) {
      return memo.get(hash)
    }

    const { index, options } = findBestShape()
    if (index === -1 || !options || options.length === 0) {
      memo.set(hash, false)
      return false
    }

    used[index] = true
    for (const placement of options) {
      placement.rows.forEach(({ rowIndex, bitMask }) => {
        boardRows[rowIndex] |= bitMask
      })
      placementsUsed.push(placement)

      let pruned = false
      const minArea = smallestRemainingShapeArea(shapeInstances, used)
      if (minArea > 0) {
        const remainingArea = remainingShapeArea(shapeInstances, used)
        const components = findEmptyComponents(boardRows, region.width, region.height)
        const totalEmpty = components.reduce((sum, size) => sum + size, 0)
        for (const size of components) {
          if (size >= minArea) continue
          if (totalEmpty - size < remainingArea) {
            pruned = true
            break
          }
        }
      }

      if (!pruned) {
        const solved = tryPlace(placedCount + 1)
        if (solved) {
          memo.set(hash, true)
          return true
        }
      }

      placementsUsed.pop()
      placement.rows.forEach(({ rowIndex, bitMask }) => {
        boardRows[rowIndex] &= ~bitMask
      })
    }
    used[index] = false
    memo.set(hash, false)
    return false
  }

  const fits = tryPlace(0)
  return {
    region,
    fits,
    timedOut,
    placements: fits ? placementsUsed.slice() : []
  }
}

function renderRegionPlacement (region, placements) {
  const grid = Array.from({ length: region.height }, () => Array(region.width).fill(EMPTY_TILE))
  placements.forEach(placement => {
    const fillTile = SHAPE_COLORS[placement.shape.shapeId % SHAPE_COLORS.length]
    placement.variant.cells.forEach(({ x, y }) => {
      const drawY = placement.position.y + y
      const drawX = placement.position.x + x
      grid[drawY][drawX] = fillTile
    })
  })
  return grid.map(row => row.join('')).join('\n')
}

function buildPlacementFromVariant (shape, variant, variantIndex, posX, posY, regionWidth) {
  const rowBitMap = new Map()
  const cells = []
  variant.cells.forEach(({ x, y }) => {
    const boardX = posX + x
    const boardY = posY + y
    const bit = 1n << BigInt(boardX)
    const existing = rowBitMap.get(boardY) || 0n
    rowBitMap.set(boardY, existing | bit)
    cells.push(boardY * regionWidth + boardX)
  })
  const rows = Array.from(rowBitMap.entries()).map(([rowIndex, bitMask]) => ({
    rowIndex,
    bitMask
  }))
  return {
    shape,
    shapeId: shape.shapeId,
    variant,
    variantIndex,
    position: { x: posX, y: posY },
    rows,
    cells
  }
}

function generateHeuristicPlacements (region) {
  const slotsX = Math.floor(region.width / BITMASK_WIDTH)
  const slotsY = Math.floor(region.height / BITMASK_HEIGHT)
  if (slotsX === 0 || slotsY === 0) {
    return []
  }

  const placements = []
  let slotIndex = 0
  const totalSlots = slotsX * slotsY
  for (const quantity of region.quantities) {
    const { shape, quantity: countNeeded } = quantity
    for (let count = 0; count < countNeeded; count++) {
      if (slotIndex >= totalSlots) {
        return []
      }
      const slotX = slotIndex % slotsX
      const slotY = Math.floor(slotIndex / slotsX)
      const posX = slotX * BITMASK_WIDTH
      const posY = slotY * BITMASK_HEIGHT
      const variantIndex = 0
      const variant = shape.variants[variantIndex]
      placements.push(buildPlacementFromVariant(shape, variant, variantIndex, posX, posY, region.width))
      slotIndex++
    }
  }
  return placements
}

function generateGreedyVisualization (region) {
  const board = Array.from({ length: region.height }, () => Array(region.width).fill(false))
  const placements = []

  const canPlace = (variant, posX, posY) => {
    if (posX + variant.width > region.width || posY + variant.height > region.height) {
      return false
    }
    return variant.cells.every(({ x, y }) => !board[posY + y][posX + x])
  }

  const applyPlacement = (shape, variant, variantIndex, posX, posY) => {
    variant.cells.forEach(({ x, y }) => {
      board[posY + y][posX + x] = true
    })
    placements.push(buildPlacementFromVariant(shape, variant, variantIndex, posX, posY, region.width))
  }

  const bucketStates = region.quantities.map(quantity => ({
    shape: quantity.shape,
    remaining: quantity.quantity
  }))
  const totalPieces = bucketStates.reduce((sum, bucket) => sum + bucket.remaining, 0)
  if (totalPieces === 0) {
    return {
      placements: [],
      completed: true
    }
  }

  let rotationCounter = 0
  let scanPointer = 0
  let bucketIndex = 0
  let placedPieces = 0
  const totalCells = region.width * region.height

  const tryPlaceShape = shape => {
    for (let offset = 0; offset < totalCells; offset++) {
      const linear = (scanPointer + offset) % totalCells
      const x = linear % region.width
      const y = Math.floor(linear / region.width)
      const variantCount = shape.variants.length
      if (variantCount === 0) {
        continue
      }

      for (let variantStep = 0; variantStep < variantCount; variantStep++) {
        const variantIndex = (rotationCounter + variantStep) % variantCount
        const variant = shape.variants[variantIndex]
        if (!canPlace(variant, x, y)) {
          continue
        }
        applyPlacement(shape, variant, variantIndex, x, y)
        rotationCounter = (rotationCounter + 1) % 8
        scanPointer = linear
        return true
      }
    }
    return false
  }

  while (placedPieces < totalPieces) {
    let traversed = 0
    while (bucketStates[bucketIndex].remaining === 0 && traversed < bucketStates.length) {
      bucketIndex = (bucketIndex + 1) % bucketStates.length
      traversed++
    }
    if (bucketStates[bucketIndex].remaining === 0) {
      break
    }

    const bucket = bucketStates[bucketIndex]
    bucket.remaining--
    bucketIndex = (bucketIndex + 1) % bucketStates.length

    const placed = tryPlaceShape(bucket.shape)
    if (!placed) {
      return {
        placements,
        completed: false,
        failedShapeId: bucket.shape.shapeId
      }
    }
    placedPieces++
  }

  return {
    placements,
    completed: true
  }
}

async function writePlacementReport (regionResults, outputPath) {
  const lines = ['# Day 12 Region Placements', '']
  regionResults.forEach(result => {
    const { region, fits, timedOut } = result
    lines.push(`## Region ${region.regionId} (${region.width}x${region.height})`)
    lines.push('')
    const status = fits ? '✅ Solved' : (timedOut ? '⏱️ Timed out' : '❌ Unsolved')
    lines.push(`- Status: ${status}`)
    lines.push('')
    if (result.heuristicReason) {
      lines.push(`Determined via heuristic: ${result.heuristicReason}.`)
      lines.push('')
    }
    if (fits && result.placements.length > 0 && result.solutionSource !== 'heuristic') {
      lines.push('```')
      lines.push(renderRegionPlacement(region, result.placements))
      lines.push('```')
      lines.push('')
      lines.push('### Placements')
      result.placements.forEach((placement, index) => {
        lines.push(`- Step ${index + 1}: Shape ${placement.shape.shapeId}, Variant ${placement.variantIndex}, Position (${placement.position.x}, ${placement.position.y})`)
      })
    } else if (timedOut) {
      lines.push('Solver timed out before finding a solution.')
    } else {
      lines.push('No valid placement found.')
    }

    if (result.greedyVisualization) {
      const { placements: greedyPlacements, completed } = result.greedyVisualization
      lines.push('')
      lines.push('### Greedy visualization')
      lines.push(completed ? '_Completed greedy pass._' : '_Greedy pass stopped early (stuck)._')
      if (greedyPlacements && greedyPlacements.length > 0) {
        lines.push('```')
        lines.push(renderRegionPlacement(result.region, greedyPlacements))
        lines.push('```')
      } else {
        lines.push('_(No placements recorded.)_')
      }
    }
    lines.push('')
  })

  return write(outputPath, lines.join('\n'))
}

function formatRegionStatus (result) {
  if (result.fits) return '✅ Solved'
  if (result.timedOut) return '⏱️ Timed out'
  return '❌ Unsolved'
}

async function writeIndividualRegionReport (result, outputPath) {
  const lines = [
    `# Region ${result.region.regionId} (${result.region.width}x${result.region.height})`,
    '',
    `- Status: ${formatRegionStatus(result)}`,
    ''
  ]
  if (result.solutionSource) {
    const sourceMap = {
      heuristic: 'Heuristic tiling',
      'brute-force': 'Brute-force solver',
      worker: 'Backtracking solver'
    }
    const label = sourceMap[result.solutionSource] || result.solutionSource
    lines.push(`Solution source: ${label}.`)
    lines.push('')
  }
  if (result.heuristicReason) {
    lines.push(`Determined via heuristic: ${result.heuristicReason}.`)
    lines.push('')
  }
  if (result.fits && result.placements.length > 0 && result.solutionSource !== 'heuristic') {
    lines.push('```')
    lines.push(renderRegionPlacement(result.region, result.placements))
    lines.push('```')
    lines.push('')
    lines.push('### Placements')
    result.placements.forEach((placement, index) => {
      lines.push(`- Step ${index + 1}: Shape ${placement.shape.shapeId}, Variant ${placement.variantIndex}, Position (${placement.position.x}, ${placement.position.y})`)
    })
  } else if (result.timedOut) {
    lines.push('Solver timed out before finding a solution.')
  } else {
    lines.push('No valid placement found.')
  }
  if (result.greedyVisualization) {
    const { placements: greedyPlacements, completed } = result.greedyVisualization
    lines.push('')
    lines.push('### Greedy visualization')
    lines.push(completed ? '_Completed greedy pass._' : '_Greedy pass stopped early (stuck)._')
    if (greedyPlacements && greedyPlacements.length > 0) {
      lines.push('```')
      lines.push(renderRegionPlacement(result.region, greedyPlacements))
      lines.push('```')
    } else {
      lines.push('_(No placements recorded.)_')
    }
  }
  lines.push('')
  await write(outputPath, lines.join('\n'))
}

async function solveForFirstStar (input, options = {}) {
  const {
    reportPath = fromHere(path.join('solutions', 'placement-report.md')),
    verbose = true,
    timeoutMs = SOLVER_TIMEOUT_MS,
    regionReportDir = fromHere('solutions'),
    regionReportPrefix = verbose ? 'placement-region-test' : 'input-region',
    bruteExampleCount = 0,
    bruteExampleMaxShapes = 12,
    forceBruteRegionIds = []
  } = options
  const presents = parsePresentList(input)

  if (verbose) {
    console.log('## Shapes\n')
    console.log(presents.shapes.toString())
    console.log('\n')
    console.log('## Regions\n')
    console.log(presents.regions.toString())
    console.log('\n')
  }

  const totalRegions = presents.regions.length
  let completedRegions = 0
  const startTime = Date.now()
  await ensureDir(regionReportDir)
  await ensureDir(path.dirname(reportPath))
  let remainingBruteExamples = bruteExampleCount
  const forcedBruteSet = new Set(forceBruteRegionIds)

  const timer = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    report(`Progress: ${elapsed}s elapsed - ${completedRegions}/${totalRegions} regions completed (${totalRegions - completedRegions} remaining)`)
  }, 10_000)

  const regionResults = Array(totalRegions)
  const pendingRegions = []
  try {
    for (let regionIndex = 0; regionIndex < presents.regions.length; regionIndex++) {
      const region = presents.regions[regionIndex]
      const heuristic = evaluateRegionHeuristics(region)
      if (forcedBruteSet.has(region.regionId)) {
        const bruteLabel = `Forced brute solve (region ${region.regionId})`
        const bruteResult = await timeSolution(bruteLabel, async () => solveRegion(region, timeoutMs))
        const resultEntry = {
          region,
          fits: bruteResult.fits,
          timedOut: bruteResult.timedOut,
          placements: bruteResult.fits ? bruteResult.placements : [],
          heuristicReason: heuristic.reason,
          solutionSource: 'brute-force'
        }
        regionResults[regionIndex] = resultEntry
        completedRegions++
        const remaining = totalRegions - completedRegions
        if (resultEntry.fits && resultEntry.placements.length > 0) {
          const paddedId = String(region.regionId).padStart(2, '0')
          const perRegionPath = path.join(regionReportDir, `${regionReportPrefix}-${paddedId}.md`)
          await writeIndividualRegionReport(resultEntry, perRegionPath)
        }
        const status = formatRegionStatus(resultEntry)
        report(`Region ${region.regionId} (${region.width}x${region.height}) ${status.toLowerCase()} via forced brute (${remaining} remaining)`)
        continue
      }
      if (heuristic.status === 'unknown') {
        pendingRegions.push({ region, index: regionIndex })
        continue
      }
      const fits = heuristic.status === 'fits'
      let placements = []
      let solutionSource = 'heuristic'
      let regionResultGreedy = null
      if (fits) {
        placements = generateHeuristicPlacements(region)
        const greedyVisualization = generateGreedyVisualization(region)
        if (greedyVisualization.placements.length > 0) {
          regionResultGreedy = greedyVisualization
        }
      }
      if (fits && remainingBruteExamples > 0) {
        const totalShapes = region.quantities.reduce((sum, quantity) => sum + quantity.quantity, 0)
        if (totalShapes <= bruteExampleMaxShapes) {
          const bruteLabel = `Brute solve (region ${region.regionId})`
          const bruteResult = await timeSolution(bruteLabel, async () => solveRegion(region, timeoutMs))
          if (bruteResult.fits && bruteResult.placements.length > 0) {
            placements = bruteResult.placements
            solutionSource = 'brute-force'
            remainingBruteExamples--
            regionResultGreedy = null
          }
        }
      }
      const regionResult = {
        region,
        fits,
        timedOut: false,
        placements,
        heuristicReason: heuristic.reason,
        solutionSource,
        greedyVisualization: regionResultGreedy
      }
      regionResults[regionIndex] = regionResult
      completedRegions++
      const remaining = totalRegions - completedRegions
      const paddedId = String(region.regionId).padStart(2, '0')
      if (regionResult.fits && regionResult.placements.length > 0) {
        const perRegionPath = path.join(regionReportDir, `${regionReportPrefix}-${paddedId}.md`)
        await writeIndividualRegionReport(regionResult, perRegionPath)
      }
      const status = formatRegionStatus(regionResult)
      const heuristicNote = heuristic.reason ? ` (heuristic: ${heuristic.reason})` : ''
      report(`Region ${region.regionId} (${region.width}x${region.height}) ${status.toLowerCase()}${heuristicNote} (${remaining} remaining)`)
    }

    const getRegionSignature = region => {
      const counts = region.quantities.map(q => q.quantity).join(',')
      return `${region.width}x${region.height}:${counts}`
    }

    const pendingGroups = []
    const signatureToGroupIndex = new Map()
    pendingRegions.forEach(({ region, index }) => {
      const signature = getRegionSignature(region)
      if (!signatureToGroupIndex.has(signature)) {
        signatureToGroupIndex.set(signature, pendingGroups.length)
        pendingGroups.push({
          region,
          signature,
          originalIndices: []
        })
      }
      pendingGroups[signatureToGroupIndex.get(signature)].originalIndices.push(index)
    })

    if (pendingGroups.length > 0) {
      await solveRegionsParallel(pendingGroups.map(group => group.region), timeoutMs, async (groupIndex, result) => {
        const group = pendingGroups[groupIndex]
        for (const originalIndex of group.originalIndices) {
          const region = presents.regions[originalIndex]
          const regionResult = {
            region,
            fits: result.fits,
            timedOut: result.timedOut,
            placements: result.fits ? result.placements : [],
            solutionSource: 'worker'
          }
          regionResults[originalIndex] = regionResult
          completedRegions++
          const remaining = totalRegions - completedRegions
          const paddedId = String(region.regionId).padStart(2, '0')
          if (regionResult.fits && regionResult.placements.length > 0) {
            const perRegionPath = path.join(regionReportDir, `${regionReportPrefix}-${paddedId}.md`)
            await writeIndividualRegionReport(regionResult, perRegionPath)
          }
          const status = formatRegionStatus(regionResult)
          const memoSuffix = group.originalIndices.length > 1 && originalIndex !== group.originalIndices[0] ? ' (memoized)' : ''
          report(`Region ${region.regionId} (${region.width}x${region.height}) ${status.toLowerCase()}${memoSuffix} (${remaining} remaining)`)
        }
      })
    }
  } finally {
    clearInterval(timer)
  }
  await writePlacementReport(regionResults, reportPath)
  const solvableRegions = regionResults.filter(result => result.fits).length
  const timedOutRegions = regionResults.filter(result => result.timedOut).length
  report('Solution 1:', solvableRegions)
  if (timedOutRegions > 0) {
    report(`Warning: ${timedOutRegions} region(s) timed out before completion`)
  }
  return solvableRegions
}

async function solveForSecondStar (input) {
  const solution = 'Happy Advent of Code 2025! 🎄 ⭐'
  report('Solution 2:', solution)
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () =>
    solveForFirstStar(test, {
      reportPath: fromHere(path.join('solutions', 'placement-report-test.md')),
      regionReportDir: fromHere('solutions'),
      verbose: true,
      bruteExampleCount: 1,
      bruteExampleMaxShapes: 6,
      forceBruteRegionIds: [0]
    })
  )
  await timeSolution('Part 1', () =>
    solveForFirstStar(input, {
      reportPath: fromHere(path.join('solutions', 'placement-report-input.md')),
      regionReportDir: fromHere('solutions'),
      verbose: false,
      bruteExampleCount: 1,
      bruteExampleMaxShapes: 15,
      forceBruteRegionIds: []
    })
  )
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

if (!isMainThread) {
  if (workerData && workerData.mode === 'solve-region') {
    const result = solveRegion(workerData.region, workerData.timeoutMs)
    parentPort.postMessage(result)
  }
} else {
  run()
}
