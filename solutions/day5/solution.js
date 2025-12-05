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
  const inventory = parseInventory(input)

  // Combine overlapping ranges until no overlaps remain
  let merged = true
  let currentRanges = inventory.ranges.slice()
  while (merged) {
    merged = false
    const newRanges = []
    const usedIndices = new Set()
    currentRanges.forEach((rangeA, rangeAIndex) => {
      if (usedIndices.has(rangeAIndex)) return
      let mergedRange = rangeA
      currentRanges.forEach((rangeB, rangeBIndex) => {
        if (rangeAIndex !== rangeBIndex && !usedIndices.has(rangeBIndex)) {
          if (!(mergedRange.end < rangeB.start || rangeB.end < mergedRange.start)) {
            // Merge ranges
            mergedRange = {
              start: Math.min(mergedRange.start, rangeB.start),
              end: Math.max(mergedRange.end, rangeB.end)
            }
            usedIndices.add(rangeBIndex)
            merged = true
          }
        }
      })
      newRanges.push(mergedRange)
      usedIndices.add(rangeAIndex)
    })
    currentRanges = newRanges
  }

  console.log('Merged Ranges:', currentRanges)

  // Count length of merged ranges; this is the number of fresh ingredients possible
  const totalFreshCapacity = currentRanges.reduce((sum, range) => sum + (range.end - range.start + 1), 0)
  console.log('Total Fresh Capacity:', totalFreshCapacity)

  const solution = totalFreshCapacity
  report('Solution 2:', solution)
}

run()
