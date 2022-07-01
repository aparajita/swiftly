import child from 'child_process'
import chalk from 'chalk'
import compare from 'compare-func'
import glob from 'fast-glob'
import thenby from 'thenby'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const kFormatStylish = 'stylish'
const kFormatSingleLine = 'unix'

const kSwiftlintErrorRE =
  /^(?<filePath>.+?):(?<line>\d+):(?<col>\d+):\s*(?<level>\w+?):\s*(?<type>.+?):\s*(?<message>.+?)\((?<code>\w+)\)/u

const kSwiftformatErrorRE =
  /^(?<filePath>.+?):(?<line>\d+):(?<col>\d+):\s*(?<level>\w+?):\s*\((?<code>\w+)\)\s*(?<message>.+)/u

function collectErrors(output, errors, regex) {
  const errorLines = output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)

  if (errorLines.length > 0) {
    for (const line of errorLines) {
      const match = regex.exec(line)

      if (match) {
        Object.keys(match.groups).forEach((key) => {
          match.groups[key] = match.groups[key].trim()

          if ('line|char'.includes(key)) {
            match.groups[key] = Number(match.groups[key])
          }
        })

        const filePath = match.groups.filePath
        let fileEntry = errors[filePath]

        if (fileEntry) {
          fileEntry.errors.push(match.groups)
        } else {
          fileEntry = { filePath, errors: [match.groups] }
          errors[filePath] = fileEntry
        }
      }
    }
  }
}

function collectSwiftlintErrors(output, errros) {
  collectErrors(output, errros, kSwiftlintErrorRE)
}

function collectSwiftformatErrors(output, errros) {
  collectErrors(output, errros, kSwiftformatErrorRE)
}

function pluralize(str, count) {
  return count === 1 ? str : `${str}s`
}

function showSummary(errros) {
  const files = Object.values(errros)

  if (files.length > 0) {
    let warningCount = 0
    let errorCount = 0

    for (const file of files) {
      // eslint-disable-next-line no-loop-func
      file.errors.forEach((error) => {
        if (error.level === 'error') {
          errorCount += 1
        } else if (error.level === 'warning') {
          warningCount += 1
        }
      })
    }

    const counts = []

    if (errorCount > 0) {
      counts.push(`${errorCount} ${pluralize('error', errorCount)}`)
    }

    if (warningCount > 0) {
      counts.push(`${warningCount} ${pluralize('warning', warningCount)}`)
    }

    const totalCount = warningCount + errorCount

    console.log(
      chalk.red(
        `\n✖ ${totalCount} ${pluralize('problem', totalCount)} (${counts.join(
          ', '
        )})`
      )
    )
  }
}

function showErrors(errors, format) {
  const files = Object.keys(errors).sort(compare())

  for (const file of files) {
    const entry = errors[file]

    const lineRefMaxLength = entry.errors.reduce((maxLength, error) => {
      const refLength = `${error.line}:${error.col}`.length
      return refLength > maxLength ? refLength : maxLength
    }, 0)

    const levelMaxLength = entry.errors.reduce((maxLength, error) => {
      return error.level.length > maxLength ? error.level.length : maxLength
    }, 0)

    entry.errors.sort(thenby.firstBy(compare('line')).thenBy(compare('char')))
    const formattedErrors = []

    if (format === kFormatStylish) {
      console.log(`\n${entry.filePath}`)
    }

    for (const error of entry.errors) {
      let level = error.level.padEnd(levelMaxLength)
      level = error.level === 'error' ? chalk.red(level) : chalk.yellow(level)

      const type = error.type ? `${error.type}: ` : ''

      if (format === kFormatStylish) {
        const lineRef = `${error.line}:${error.col}`.padEnd(lineRefMaxLength)
        formattedErrors.push(
          `  ${chalk.dim(`${lineRef}`)}  ${level}  ${type}${
            error.message
          } ${chalk.dim(error.code)}`
        )
      } else {
        const color = error.level === 'error' ? 'red' : 'yellow'
        const location = chalk[color](
          `${error.filePath}:${error.line}:${error.col}`
        )
        formattedErrors.push(
          `${location}: ${type}${error.message} ${chalk.dim(error.code)}`
        )
      }
    }

    console.log(formattedErrors.join('\n'))
  }
}

function swiftlint(args, errors) {
  const result = child.spawnSync('node-swiftlint', args, {
    encoding: 'utf8'
  })

  collectSwiftlintErrors(result.stdout, errors)
}

function swiftformat(args, errors) {
  args.unshift('--lint')
  const result = child.spawnSync('swiftformat', args, {
    encoding: 'utf8'
  })

  collectSwiftformatErrors(result.stderr, errors)
}

function lint(args, options) {
  const errors = {}

  if (!options.swiftformat) {
    swiftlint(args, errors)
  }

  if (!options.swiftlint) {
    swiftformat(args, errors)
  }

  if (!options.quiet) {
    showErrors(errors, options.singleLine ? kFormatSingleLine : kFormatStylish)
    showSummary(errors)
  }

  if (Object.keys(errors).length > 0) {
    process.exit(1)
  }
}

function fix(args, options) {
  if (!options.swiftformat) {
    const lintArgs = args.slice()
    lintArgs.push('--fix', '--quiet')

    const result = child.spawnSync('node-swiftlint', lintArgs, {
      encoding: 'utf8'
    })

    if (result.status !== 0) {
      console.error(result.stderr)
      process.exit(result.status)
    }
  }

  if (!options.swiftlint) {
    const result = child.spawnSync('swiftformat', args, {
      encoding: 'utf8'
    })

    if (result.status !== 0) {
      console.error(result.stderr)
      process.exit(result.status)
    }
  }
}

function parseArgs() {
  const options = yargs(hideBin(process.argv))
    .usage('Usage: swiftly [options] [files]')
    .option('l', {
      alias: 'swiftlint',
      type: 'boolean',
      describe: 'Only run swiftlint'
    })
    .option('f', {
      alias: 'swiftformat',
      type: 'boolean',
      describe: 'Only run swiftformat'
    })
    .conflicts('swiftlint', 'swiftformat')
    .option('F', {
      alias: 'fix',
      type: 'boolean',
      describe: 'Fix any fixable errors'
    })
    .option('s', {
      alias: 'single-line',
      type: 'boolean',
      describe: 'Output errors like eslint’s unix format'
    })
    .option('q', {
      alias: 'quiet',
      type: 'boolean',
      describe: 'Do not produce any output'
    })
    .parseSync()

  const files = []

  // Expand any globs
  for (const pattern of options._) {
    const matches = glob.sync(pattern)

    if (matches.length === 0) {
      // No glob in the pattern, use as is
      files.push(pattern)
    } else {
      files.push(...matches)
    }
  }

  return { files, options }
}

export default function run() {
  const { files, options } = parseArgs()

  if (options.fix) {
    fix(files, options)
  }

  lint(files, options)
}
