const path = require('path')
const { read, position } = require('promise-path')
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

  await timeSolution('Part 1 (test)', () => solveForFirstStar(test))
  // await timeSolution('Part 1', () => solveForFirstStar(input))
  await timeSolution('Part 2', () => solveForSecondStar(input))
}

function parsePresentList (input) {
  const sections = input.split('\n\n').map(line => line.trim()).filter(line => line.length > 0)
  const shapes = sections.slice(0, -1).map((section, shapeId) => {
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const shapeMask = lines.slice(1)
    return {
      shapeId,
      shapeMask: shapeMask.map(line => line.split('').map(char => char === '#' ? 1 : 0))
    }
  })

  shapes.toString = function () {
    return this.map(shape => {
      const shapeLines = shape.shapeMask.map(row => row.map(cell => cell === 1 ? '#' : '.').join('')).join('\n')
      return `Shape ${shape.shapeId}:\n${shapeLines}`
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
