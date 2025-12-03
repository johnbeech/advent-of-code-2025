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

async function solveForFirstStar (input) {
  const batteryBank = parseBatteryBank(input)
  const joltages = batteryBank.map(joltBattery)

  console.log('Joltages:', joltages)

  const solution = joltages.reduce((sum, item) => sum + item.joltage, 0) // sum of all joltages
  report('Input:', `\n${input}`)
  report('Solution 1:', solution)
}

async function solveForSecondStar (input) {
  const solution = 'UNSOLVED'
  report('Solution 2:', solution)
}

run()
