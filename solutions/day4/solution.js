const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

const neighborCoords = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 }
]

function parseMap (input) {
  const lines = input.split('\n')
  const map = lines.map((line, y) => line.split('').map((char, x) => {
    return {
      char,
      empty: char === '.',
      roll: char === '@',
      x,
      y
    }
  }))

  const items = map.reduce((acc, row) => {
    row.forEach(item => {
      acc.push(item)
    })
    return acc
  }, [])

  function toString (charMapper = item => item.char) {
    return map.map(row => row.map(charMapper).join('')).join('\n')
  }

  items.forEach(item => {
    item.neighbors = neighborCoords.map(offset => {
      const nx = item.x + offset.x
      const ny = item.y + offset.y
      if (nx < 0 || nx >= map[0].length || ny < 0 || ny >= map.length) {
        return null
      }
      return map[ny][nx]
    }).filter(n => n !== null)
  })

  return {
    items,
    width: map[0].length,
    height: map.length,
    map,
    toString
  }
}

async function solveForFirstStar (input) {
  const grid = parseMap(input)

  grid.items.forEach(item => {
    const neighboringRolls = item.neighbors.filter(n => n.roll).length
    if (neighboringRolls < 4 && item.roll === true) {
      item.accessibleByForklift = true
    }
  })

  const rollsAccessibleByForklift = grid.items.filter(item => item.accessibleByForklift === true).length
  const solution = rollsAccessibleByForklift

  console.log(grid.toString((item) => {
    if (item.accessibleByForklift) {
      return 'x'
    }
    return item.char
  }))

  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
