const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseProductRanges (input) {
  return input.split(',').map(range => {
    const [firstId, lastId] = range.split('-').map(Number)
    return { firstId, lastId }
  })
}

function findInvalidIds (firstId, lastId) {
  const validIds = []
  const invalidIds = []
  const errors = []

  const firstIdNum = Number.parseInt(firstId, 10)
  const lastIdNum = Number.parseInt(lastId, 10)

  if (Number.isNaN(firstIdNum)) {
    errors.push(`First ID is not a number: ${firstId}`)
  }
  if (Number.isNaN(lastIdNum)) {
    errors.push(`Last ID is not a number: ${lastId}`)
  }
  if (firstIdNum > lastIdNum) {
    errors.push(`First ID ${firstId} is greater than Last ID ${lastId}`)
  }

  if (errors.length > 0) {
    return { validIds, invalidIds, errors }
  }

  let currentId = firstIdNum
  let sumOfInvalidIds = 0
  while (currentId <= lastIdNum) {
    const firstHalf = String(currentId).slice(0, -1 * Math.floor(String(currentId).length / 2))
    const secondHalf = String(currentId).slice(-1 * Math.floor(String(currentId).length / 2))

    if (firstHalf === secondHalf) {
      invalidIds.push(currentId)
      sumOfInvalidIds += currentId
    } else {
      validIds.push(currentId)
    }
    currentId = currentId + 1
  }

  return {
    firstId,
    lastId,
    validIds,
    invalidIds,
    sumOfInvalidIds,
    errors
  }
}

async function solveForFirstStar (input) {
  const productRanges = parseProductRanges(input)
  const analysis = productRanges.map(range => findInvalidIds(range.firstId, range.lastId))
  const solution = analysis.reduce((acc, curr) => acc + curr.sumOfInvalidIds, 0)

  report('Input:', input)
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
