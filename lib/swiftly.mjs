import child from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'
import compare from 'compare-func'
import glob from 'fast-glob'
import thenby from 'thenby'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

/*
swiftlint output
[
  {
    "character" : null,
    "file" : "\/Users\/aparajita\/Developer\/lib\/js\/@aparajita\/swiftly\/test\/fixed\/HasErrors.swift",
    "line" : 35,
    "reason" : "Line should be 200 characters or less: currently 217 characters",
    "rule_id" : "line_length",
    "severity" : "Error",
    "type" : "Line Length"
  }
]

swiftformat output
[
  {
    "file" : "/Users/aparajita/Developer/lib/js/@aparajita/swiftly/test/HasWarnings.swift",
    "line" : 2,
    "reason" : "Add or remove space around operators or delimiters.",
    "rule_id" : "spaceAroundOperators"
  }
]
*/

const kFormatStylish = 'stylish'
const kFormatSingleLine = 'unix'

function collectErrors(output, errors) {
  const parsedErrors = JSON.parse(output)

  for (const err of parsedErrors) {
    const error = { ...err }

    // For some reason swiftlint escapes the forward slashes in the file path
    error.file = error.file.replace(/\\/gu, '')
    error.character = error.character ?? 1
    error.severity = error.severity ? error.severity.toLowerCase() : 'warning'
    error.type = error.type ?? ''

    let fileEntry = errors[error.file]

    if (fileEntry) {
      fileEntry.errors.push(error)
    } else {
      fileEntry = { filePath: error.file, errors: [error] }
      errors[error.file] = fileEntry
    }
  }
}

function pluralize(str, count) {
  return count === 1 ? str : `${str}s`
}

function showSummary(errors) {
  const files = Object.values(errors)

  if (files.length > 0) {
    let warningCount = 0
    let errorCount = 0

    for (const file of files) {
      for (const error of file.errors) {
        if (error.severity === 'error') {
          errorCount += 1
        } else if (error.severity === 'warning') {
          warningCount += 1
        }
      }
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
      const refLength = `${error.line}:${error.character}`.length
      return refLength > maxLength ? refLength : maxLength
    }, 0)

    const levelMaxLength = entry.errors.reduce((maxLength, error) => {
      return error.severity.length > maxLength
        ? error.severity.length
        : maxLength
    }, 0)

    entry.errors.sort(
      thenby.firstBy(compare('line')).thenBy(compare('character'))
    )
    const formattedErrors = []

    if (format === kFormatStylish) {
      console.log(`\n${entry.filePath}`)
    }

    for (const error of entry.errors) {
      let level = error.severity.padEnd(levelMaxLength)
      level =
        error.severity === 'error' ? chalk.red(level) : chalk.yellow(level)

      const type = error.type ? `${error.type}: ` : ''

      if (format === kFormatStylish) {
        const lineRef = `${error.line}:${error.character}`.padEnd(
          lineRefMaxLength
        )
        formattedErrors.push(
          `  ${chalk.dim(`${lineRef}`)}  ${level}  ${type}${
            error.reason
          } ${chalk.dim(error.rule_id)}`
        )
      } else {
        const color = error.severity === 'error' ? 'red' : 'yellow'
        const location = chalk[color](
          `${error.filePath}:${error.line}:${error.character}`
        )
        formattedErrors.push(
          `${location}: ${type}${error.reason} ${chalk.dim(error.rule_id)}`
        )
      }
    }

    console.log(formattedErrors.join('\n'))
  }
}

function checkSpawnResult(result) {
  // result.status === 1 means the linted files were not clean
  if (result.status !== 0 && result.status !== 1) {
    const error = new Error(result.stderr)
    error.status = result.status
    throw error
  }
}

function swiftlint(files, errors) {
  const args = ['lint', '--reporter', 'json', '--quiet', ...files]
  const result = child.spawnSync('node-swiftlint', args, {
    encoding: 'utf8',
  })

  checkSpawnResult(result, 1)

  // Skip anything before the start of the actual results,
  // such as status messages.
  const lines = result.stdout.split('\n')
  const startIndex = lines.findIndex((line) => line.startsWith('['))

  if (startIndex >= 0) {
    lines.splice(0, startIndex)
  }

  collectErrors(lines.join('\n'), errors)
}

function swiftformat(files, errors) {
  const tempDir = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`)
  const jsonFile = path.join(tempDir, 'swiftformat.json')
  const args = ['--lint', '--report', jsonFile, '--quiet', ...files]

  const result = child.spawnSync('swiftformat', args, {
    encoding: 'utf8',
  })

  try {
    checkSpawnResult(result, 1)
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true })
    throw error
  }

  const text = fs.readFileSync(jsonFile, 'utf-8')
  fs.rmSync(tempDir, { recursive: true, force: true })
  collectErrors(text, errors)
}

function lint(files, options) {
  const errors = {}

  if (!options.swiftformat) {
    swiftlint(files, errors)
  }

  if (!options.swiftlint) {
    swiftformat(files, errors)
  }

  if (!options.quiet) {
    showErrors(errors, options.singleLine ? kFormatSingleLine : kFormatStylish)
    showSummary(errors)
  }

  return Object.keys(errors).length
}

function fix(args, options) {
  if (!options.swiftformat) {
    const lintArgs = args.slice()
    lintArgs.push('--fix', '--quiet')

    const result = child.spawnSync('node-swiftlint', lintArgs, {
      encoding: 'utf8',
    })

    checkSpawnResult(result, 1)
  }

  if (!options.swiftlint) {
    const result = child.spawnSync('swiftformat', args, {
      encoding: 'utf8',
    })

    checkSpawnResult(result, 1)
  }
}

function parseArgs() {
  const options = yargs(hideBin(process.argv))
    .usage('Usage: swiftly [options] [files]')
    .option('l', {
      alias: 'swiftlint',
      type: 'boolean',
      describe: 'Only run swiftlint',
    })
    .option('f', {
      alias: 'swiftformat',
      type: 'boolean',
      describe: 'Only run swiftformat',
    })
    .conflicts('swiftlint', 'swiftformat')
    .option('F', {
      alias: 'fix',
      type: 'boolean',
      describe: 'Fix any fixable errors',
    })
    .option('s', {
      alias: 'single-line',
      type: 'boolean',
      describe: 'Output errors like eslint’s unix format',
    })
    .option('q', {
      alias: 'quiet',
      type: 'boolean',
      describe: 'Do not produce any output',
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
  try {
    const { files, options } = parseArgs()

    if (options.fix) {
      fix(files, options)
    }

    const errorCount = lint(files, options)
    process.exit(errorCount === 0 ? 0 : 1)
  } catch (error) {
    console.error(error.message)
    process.exit(error.statusCode ?? 1)
  }
}
