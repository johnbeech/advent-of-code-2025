const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseInventory (input) {
  const [rangeLines, idLines] = input.split('\n\n')

  const ranges = rangeLines.split('\n').map(line => {
    const [start, end] = line.split('-').map(Number)
    return { start, end }
  })

  const ids = idLines.split('\n').map(Number)

  const ingredients = ids.map(id => {
    for (const range of ranges) {
      if (id >= range.start && id <= range.end) {
        return { id, range, fresh: true }
      }
    }
    return { id, range: null, fresh: false }
  })

  return {
    ranges,
    ids,
    ingredients,
    freshIngredients: ingredients.filter(ing => ing.fresh),
    staleIngredients: ingredients.filter(ing => !ing.fresh)
  }
}

async function solveForFirstStar (input) {
  const inventory = parseInventory(input)

  console.log('Ranges:', inventory.ranges)
  console.log('IDs:', inventory.ids)
  console.log('Ingredients:', inventory.ingredients)

  const solution = inventory.freshIngredients.length
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
