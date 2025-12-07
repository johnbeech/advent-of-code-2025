const path = require('path')
const { read, write, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseSparseGrid (input) {
  const grid = new Map()
  let tachyonSource = {}
  input.split('\n').forEach((line, y) => {
    line.split('').forEach((char, x) => {
      if (char !== '.') {
        const record = {
          x,
          y,
          value: char,
          isTachyonSource: char === 'S',
          isSplitter: char === '^',
          splitterActivated: false
        }
        if (record.isTachyonSource) {
          tachyonSource = record
        }
        grid.set(`${x},${y}`, record)
      }
    })
  })
  const bounds = {
    minX: 0,
    maxX: input.split('\n')[0].length - 1,
    minY: 0,
    maxY: input.split('\n').length - 1
  }

  function render (callback = (cell) => cell.value) {
    let output = ''
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const cell = grid.get(`${x},${y}`)
        output += callback(cell ?? {})
      }
      output += '\n'
    }
    return output
  }

  return { grid, tachyonSource, bounds, render }
}

function createEmptyCell (x, y, value = '.') {
  return { x, y, value, beamTouched: false, isSplitter: false, splitterActivated: false }
}

function renderFn (cell) {
  if (cell.isTachyonSource) return '🟨'
  if (cell.isSplitter) return cell.splitterActivated ? '❎' : '⬜'
  if (cell.value === '🟥' || cell.value === '🟦') return cell.value
  if (cell.beamTouched) return '🟡'
  if (cell.value === '.' || cell?.value === undefined) return '⬛'
  return cell.value
}

async function solveForFirstStar (input) {
  const { grid, tachyonSource, bounds, render } = parseSparseGrid(input)

  // Simulate the tachyon beam moving dowards until it hits a splitter
  // When it hits a splitter, it stops, and activates the splitter, spawning new beans either side
  // The new beams then move downwards in the same way, activating splitters as they go
  // Beams stop when they go out of bounds at the bottom of the grid
  const beams = [{ x: tachyonSource.x, y: tachyonSource.y + 1 }]

  while (beams.length > 0) {
    const beam = beams.shift()
    if (beam.y > bounds.maxY) {
      // Out of bounds, stop this beam
      continue
    }
    const cell = grid.get(`${beam.x},${beam.y}`) ?? createEmptyCell(beam.x, beam.y)
    cell.beamTouched = true
    if (cell.isSplitter && !cell.splitterActivated) {
      // Activate the splitter and spawn new beams
      cell.splitterActivated = true
      const newBeamCellL = createEmptyCell(beam.x - 1, beam.y, '🟥')
      const newBeamCellR = createEmptyCell(beam.x + 1, beam.y, '🟦')
      grid.set(`${newBeamCellL.x},${newBeamCellL.y}`, newBeamCellL)
      grid.set(`${newBeamCellR.x},${newBeamCellR.y}`, newBeamCellR)
      beams.push(newBeamCellL)
      beams.push(newBeamCellR)
    } else if (cell.isSplitter && cell.splitterActivated) {
      // Splitter activated alredy - stop this beam from propagating
    } else {
      // Continue moving downwards
      beams.push({ x: beam.x, y: beam.y + 1 })
    }
    // Update the cell in the grid
    grid.set(`${cell.x},${cell.y}`, cell)
  }

  console.log('Final grid state:\n' + render(renderFn))

  await write(fromHere('output.txt'), render(renderFn))

  const solution1 = Array.from(grid.values()).filter(cell => cell.splitterActivated).length
  report('Solution 1:', solution1)
}

async function solveForSecondStar (input) {
  const { grid, tachyonSource, bounds } = parseSparseGrid(input)

  // Use memoized recursion to count unique timelines
  const memo = new Map()

  function countTimelines (x, y) {
    const key = `${x},${y}`

    if (y > bounds.maxY) {
      return 1 // One valid timeline exits here
    }

    if (memo.has(key)) {
      return memo.get(key)
    }

    const cell = grid.get(key)
    let count

    if (cell?.isSplitter) {
      // Sum timelines from both branches
      count = countTimelines(x - 1, y + 1) + countTimelines(x + 1, y + 1)
    } else {
      count = countTimelines(x, y + 1)
    }

    memo.set(key, count)
    return count
  }

  const solution = countTimelines(tachyonSource.x, tachyonSource.y + 1)
  report('Solution 2:', solution)
}

run()
