const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)
const BITMASK_WIDTH = 3
const BITMASK_HEIGHT = 3
const SHAPE_COLORS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬜']
const EMPTY_TILE = '⬛'

async function timeSolution (label, fn) {
  const start = process.hrtime.bigint()
  const result = await fn()
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6
  report(`${label} completed in ${elapsedMs.toFixed(3)}ms`)
  return result
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

function bitmaskToLines (bitmask, filledTile) {
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

  return Array.from(variants)
}

async function run () {
  const test = (await read(fromHere('test.txt'), 'utf8')).trim()
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await timeSolution('Part 1 (test)', () => solveForFirstStar(test))
  // await timeSolution('Part 1', () => solveForFirstStar(input))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parsePresentList (input) {
  const sections = input.split('\n\n').map(line => line.trim()).filter(line => line.length > 0)
  const shapes = sections.slice(0, -1).map((section, shapeId) => {
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const shapeMask = lines.slice(1)
    const maskMatrix = shapeMask.map(line => line.split('').map(char => char === '#' ? 1 : 0))
    const bitmask = encodeMatrixToBitmask(maskMatrix)
    return {
      shapeId,
      width: BITMASK_WIDTH,
      height: BITMASK_HEIGHT,
      bitmask,
      variants: getShapeVariants(bitmask)
    }
  })

  shapes.toString = function () {
    return this.map(shape => {
      const variantLines = shape.variants.map((bitmask, variantIndex) => {
        const filledTile = SHAPE_COLORS[variantIndex % SHAPE_COLORS.length]
        return bitmaskToLines(bitmask, filledTile)
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

async function solveForFirstStar (input) {
  const presents = parsePresentList(input)

  console.log('## Shapes\n')
  console.log(presents.shapes.toString())
  console.log('\n')
  console.log('## Regions\n')
  console.log(presents.regions.toString())
  console.log('\n')

  const solution = 'UNSOLVED'
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
