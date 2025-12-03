const path = require('path')
const { read, position } = require('promise-path')
const fromHere = position(__dirname)
const report = (...messages) => console.log(`[${require(fromHere('../../package.json')).logName} / ${__dirname.split(path.sep).pop()}]`, ...messages)

async function run () {
  const input = (await read(fromHere('input.txt'), 'utf8')).trim()

  await solveForFirstStar(input)
  await solveForSecondStar(input)
}

function parseBatteryBank (input) {
  const lines = input.split('\n')
  const batteryBank = lines.map(line => line.split('').map((char, index) => {
    return {
      value: Number.parseInt(char, 10),
      on: false,
      index
    }
  }))
  return batteryBank
}

function joltBattery (batteryItem) {
  // Find the largest two values, and then concatenate them, and convert into a number
  const largestValueItem = batteryItem.reduce((maxItem, item) => {
    return item.value > maxItem.value ? item : maxItem
  }, { value: -Infinity })
  // If largest item is last index, then second largest is the largest of the rest
  // Otherwise, second largest must be to the right of largest
  const secondLargestValueItem = batteryItem.reduce((maxItem, item) => {
    if (item.index === largestValueItem.index) {
      return maxItem
    }
    if (largestValueItem.index === batteryItem.length - 1) {
      return item.value > maxItem.value ? item : maxItem
    } else {
      return item.index > largestValueItem.index && item.value > maxItem.value ? item : maxItem
    }
  }, { value: -Infinity })

  const originalOrder = [largestValueItem, secondLargestValueItem].sort((a, b) => a.index - b.index)
  const joltage = originalOrder[0].value * 10 + originalOrder[1].value

  return {
    batteryItem: batteryItem.map(item => item.value).join(''),
    joltage,
    largestValueItem,
    secondLargestValueItem
  }
}

function joltBatteryx12 (batteryItem) {
  const keepCount = 12
  if (batteryItem.length === 0) {
    return { batteryItem: '', line: '', joltage: 0 }
  }

  // Walk left to right along battery row
  const n = batteryItem.length
  let toDrop = n - keepCount

  const keepers = []

  for (let i = 0; i < n; i++) {
    const current = batteryItem[i]

    // Pop lower previous values while we can still drop
    while (
      toDrop > 0 &&
      keepers.length > 0 &&
      keepers[keepers.length - 1].value < current.value
    ) {
      keepers.pop()
      toDrop--
    }

    keepers.push(current)
  }

  // If we have more than keepCount items; keep the first keepCount
  const chosen = keepers.slice(0, keepCount)

  // Mark chosen batteries as "on"
  const chosenSet = new Set(chosen.map(item => item.index))
  batteryItem.forEach(item => {
    item.on = chosenSet.has(item.index)
  })

  const joltage = Number(chosen.map(item => item.value).join(''))

  return {
    batteryItem: batteryItem.map(item => item.value).join(''),
    batteryDisp: batteryItem.map(item => (item.on ? item.value : '_')).join(''),
    joltage
  }
}

async function solveForFirstStar (input) {
  const batteryBank = parseBatteryBank(input)
  const joltages = batteryBank.map(joltBattery)

  console.log('Joltages:', joltages)

  const solution = joltages.reduce((sum, item) => sum + item.joltage, 0) // sum of all joltages
  report('Input:', `\n${input}`)
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const batteryBank = parseBatteryBank(input)
  const joltages = batteryBank.map(joltBatteryx12)

  console.log('Joltages x12:', joltages)

  const solution = joltages.reduce((sum, item) => sum + item.joltage, 0)
  report('Solution 2:', solution)
}

run()
